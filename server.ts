import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Autoriser les images base64 haute résolution de la CNIE et des pages PDF scannées
  app.use(express.json({ limit: '25mb' }));

  // Endpoint serveur d'extraction OCR structurée de la Carte Nationale (CNIE) via Gemini
  app.post('/api/cnie/extract', async (req, res) => {
    try {
      const { rectoDataUrl, versoDataUrl } = req.body as {
        rectoDataUrl?: string;
        versoDataUrl?: string;
      };

      if (!rectoDataUrl) {
        return res.status(400).json({ error: 'Aucune image Recto fournie.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'GEMINI_UNAVAILABLE',
          message: 'Clé API Gemini non configurée sur le serveur.'
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const parseDataUrl = (dataUrl: string) => {
        const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match) {
          return { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] || '' };
        }
        return { mimeType: match[1], data: match[2] };
      };

      const rectoParsed = parseDataUrl(rectoDataUrl);
      const parts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | { text: string }
      > = [
        {
          inlineData: {
            mimeType: rectoParsed.mimeType,
            data: rectoParsed.data
          }
        }
      ];

      if (versoDataUrl) {
        const versoParsed = parseDataUrl(versoDataUrl);
        parts.push({
          inlineData: {
            mimeType: versoParsed.mimeType,
            data: versoParsed.data
          }
        });
      }

      parts.push({
        text:
          "Tu es un système expert de lecture optique de la Carte Nationale d'Identité Électronique marocaine (CNIE / CIN). " +
          "Extrais uniquement les champs réellement lisibles sur l'image de la carte en JSON strict : " +
          "nom (nom de famille en majuscules), prenom (prénom), cin (numéro de carte CNIE : 1 ou 2 lettres suivies de 5 à 6 chiffres, ex: CD123456), " +
          "date_naissance (au format JJ/MM/AAAA ou AAAA-MM-JJ), lieu_naissance (ville ou commune de naissance), " +
          "adresse (adresse de résidence figurant sur la carte, souvent au verso), " +
          "date_validite (date d'expiration / valable jusqu'au, au format JJ/MM/AAAA ou AAAA-MM-JJ). " +
          "RÈGLE ABSOLUE : Si un champ est absent, flou ou illisible sur l'image, renvoie une chaîne vide \"\" pour ce champ. N'invente JAMAIS aucune valeur."
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction:
            'Extrais les informations de la Carte Nationale (CNIE) marocaine en JSON strict. Si un champ est illisible ou absent, renvoie une chaîne vide "" sans jamais inventer de valeur.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nom: {
                type: Type.STRING,
                description: 'Nom de famille figurant sur la CNIE, ou chaîne vide si illisible.'
              },
              prenom: {
                type: Type.STRING,
                description: 'Prénom figurant sur la CNIE, ou chaîne vide si illisible.'
              },
              cin: {
                type: Type.STRING,
                description: 'Numéro de la CNIE (1 ou 2 lettres suivies de 5 à 6 chiffres), ou chaîne vide si illisible.'
              },
              date_naissance: {
                type: Type.STRING,
                description: 'Date de naissance (JJ/MM/AAAA ou AAAA-MM-JJ), ou chaîne vide si illisible.'
              },
              lieu_naissance: {
                type: Type.STRING,
                description: 'Lieu de naissance figurant sur la CNIE, ou chaîne vide si illisible.'
              },
              adresse: {
                type: Type.STRING,
                description: 'Adresse de résidence figurant sur la CNIE, ou chaîne vide si illisible.'
              },
              date_validite: {
                type: Type.STRING,
                description: "Date d'expiration / validité de la CNIE (JJ/MM/AAAA ou AAAA-MM-JJ), ou chaîne vide si illisible."
              }
            },
            required: ['nom', 'prenom', 'cin', 'date_naissance', 'lieu_naissance', 'adresse', 'date_validite']
          }
        }
      });

      const rawText = (response.text ?? '{}').trim();
      const extracted = JSON.parse(rawText);

      return res.json({
        engine: 'GEMINI',
        data: {
          nom: typeof extracted.nom === 'string' ? extracted.nom.trim() : '',
          prenom: typeof extracted.prenom === 'string' ? extracted.prenom.trim() : '',
          cin: typeof extracted.cin === 'string' ? extracted.cin.trim() : '',
          date_naissance: typeof extracted.date_naissance === 'string' ? extracted.date_naissance.trim() : '',
          lieu_naissance: typeof extracted.lieu_naissance === 'string' ? extracted.lieu_naissance.trim() : '',
          adresse: typeof extracted.adresse === 'string' ? extracted.adresse.trim() : '',
          date_validite: typeof extracted.date_validite === 'string' ? extracted.date_validite.trim() : ''
        }
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue Gemini';
      console.error('Erreur extraction Gemini CNIE :', errorMsg);
      return res.status(502).json({
        error: 'GEMINI_ERROR',
        message: errorMsg
      });
    }
  });

  // Endpoint serveur de vérification de conformité de type des pièces justificatives (Étape 1)
  app.post('/api/documents/verify', async (req, res) => {
    try {
      const {
        expectedType,
        pageCount,
        extractedText,
        pageImages
      } = req.body as {
        expectedType?: string;
        pageCount?: number;
        extractedText?: string;
        pageImages?: string[];
      };

      if (!expectedType) {
        return res.status(400).json({ error: 'Type de pièce attendu manquant.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'GEMINI_UNAVAILABLE',
          message: 'Clé API Gemini non configurée sur le serveur.'
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const parts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | { text: string }
      > = [];

      if (Array.isArray(pageImages)) {
        for (const imgUrl of pageImages.slice(0, 4)) {
          if (typeof imgUrl !== 'string') continue;
          const match = imgUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            });
          }
        }
      }

      const trimmedText = (extractedText || '').trim().slice(0, 18000);

      parts.push({
        text:
          `Tu es un contrôleur expert de conformité documentaire pour les candidatures doctorales (CEDoc USMBA).\n` +
          `La case de dépôt sélectionnée par le candidat attend le type : "${expectedType}".\n` +
          `Nombre réel de pages du PDF : ${pageCount || 1}.\n` +
          (trimmedText
            ? `Texte extrait du PDF via pdf.js :\n"""\n${trimmedText}\n"""\n\n`
            : `Aucun texte exploitable extrait via pdf.js : analyse attentivement les images des pages ci-jointes.\n\n`) +
          `CONSIGNES STRICTES :\n` +
          `1. Ignore totalement tout nom de fichier (il n'est même pas fourni). Base-toi UNIQUEMENT sur le contenu réel du document.\n` +
          `2. Détermine à quel type réel appartient ce document ("detectedType") parmi :\n` +
          `   - "Carte d'identité nationale (CIN)"\n` +
          `   - "Attestation de réussite de Licence"\n` +
          `   - "Diplôme de Master / Ingénieur"\n` +
          `   - "Relevés de notes Master (S1-S4)"\n` +
          `   - "Projet de recherche rédigé"\n` +
          `   - "Curriculum Vitae détaillé"\n` +
          `   - "AUTRE"\n` +
          `3. Évalue objectivement chaque indicateur booléen ci-dessous (true UNIQUEMENT si l'élément est réellement visible/présent dans le contenu du document, false sinon ; n'invente JAMAIS rien) :\n` +
          `   - hasMentionCnie : mention explicite de carte nationale d'identité (CNIE / CIN / Royaume du Maroc Carte Nationale d'Identité / البطاقة الوطنية للتعريف)\n` +
          `   - detectedCinNumber : numéro CIN lisible (1 ou 2 lettres + 5 à 6 chiffres, ex: CD712345), sinon ""\n` +
          `   - hasNomEtPrenom : nom et prénom du titulaire clairement présents\n` +
          `   - hasDateNaissance : date de naissance clairement présente\n` +
          `   - hasDateValidite : date de validité / expiration clairement présente\n` +
          `   - hasRectoEtVerso : les deux faces (recto ET verso) sont présentes (ex: 2 pages distinctes recto et verso)\n` +
          `   - hasMentionLicence : mention explicite "Licence"\n` +
          `   - hasAttestationReussite : mention explicite "attestation de réussite" (ou formule équivalente d'attestation de réussite)\n` +
          `   - hasEtablissement : nom d'un établissement universitaire / faculté / école\n` +
          `   - hasAnnee : année universitaire ou année d'obtention\n` +
          `   - hasNom : nom du candidat présent dans le document\n` +
          `   - hasCne : numéro CNE ou Code Massar présent (ex: N143098765, G130012345, mention CNE / Massar)\n` +
          `   - hasMentionMasterOuIngenieur : mention explicite "Master" ou "Ingénieur"\n` +
          `   - hasIntituleFiliere : intitulé de la filière ou spécialité du diplôme (pas seulement le mot générique "Master")\n` +
          `   - hasMentionReleveNotes : mention "relevé de notes" (ou "relevés de notes" / "transcript")\n` +
          `   - hasSemestreS1 : notes ou section explicite du semestre S1 (ou Semestre 1)\n` +
          `   - hasSemestreS2 : notes ou section explicite du semestre S2 (ou Semestre 2)\n` +
          `   - hasSemestreS3 : notes ou section explicite du semestre S3 (ou Semestre 3)\n` +
          `   - hasSemestreS4 : notes ou section explicite du semestre S4 (ou Semestre 4)\n` +
          `   - hasNotesOuMoyennes : notes chiffrées ou moyennes des modules/semestres\n` +
          `   - hasTitreProjetRecherche : titre ou sujet explicite du projet de recherche / thèse\n` +
          `   - hasObjectifsOuProblematique : présence d'objectifs ou d'une problématique scientifique\n` +
          `   - hasMethodologie : présence d'une méthodologie de recherche\n` +
          `   - hasRubriquesCv : rubriques de type formation, expériences ou compétences\n` +
          `   - hasCoordonnees : coordonnées du candidat (email, téléphone ou adresse)\n` +
          `   - isScanIllisible : true si le scan ou l'image est flou, sombre, coupé, de mauvaise résolution ou difficilement lisible (en cas de doute sur la lisibilité, mets true), false si le texte ou l'image est parfaitement net et lisible\n` +
          `   - isTypeIncertain : true si le type réel du document ou la présence de ses mentions obligatoires reste incertain ou ambigu, false sinon\n` +
          `4. Extrais dans "extractedCandidate" les informations personnelles réellement lisibles dans le document (chaîne vide "" si absente ou illisible ; n'invente JAMAIS) :\n` +
          `   - nom : nom de famille du candidat figurant sur le document\n` +
          `   - prenom : prénom du candidat figurant sur le document\n` +
          `   - cin : numéro CIN figurant sur le document (ex: CD712345)\n` +
          `   - cne : numéro CNE ou Code Massar figurant sur le document (ex: N143098765)\n` +
          `   - date_naissance : date de naissance figurant sur le document\n` +
          `   - lieu_naissance : lieu/ville de naissance figurant sur le document\n` +
          `   - filiere : intitulé de la filière / spécialité (notamment Master / Ingénieur) figurant sur le document\n` +
          `   - email : adresse e-mail du candidat figurant sur le document\n` +
          `   - titre_sujet : titre complet du sujet / projet de recherche figurant sur le document\n`
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction:
            "Tu es un vérificateur strict de conformité de documents académiques et d'identité. Réponds uniquement en JSON strict selon le schéma fourni. N'invente jamais d'élément absent.",
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedType: {
                type: Type.STRING,
                enum: [
                  "Carte d'identité nationale (CIN)",
                  'Attestation de réussite de Licence',
                  'Diplôme de Master / Ingénieur',
                  'Relevés de notes Master (S1-S4)',
                  'Projet de recherche rédigé',
                  'Curriculum Vitae détaillé',
                  'AUTRE'
                ]
              },
              detectedSummary: { type: Type.STRING },
              hasMentionCnie: { type: Type.BOOLEAN },
              detectedCinNumber: { type: Type.STRING },
              hasNomEtPrenom: { type: Type.BOOLEAN },
              hasDateNaissance: { type: Type.BOOLEAN },
              hasDateValidite: { type: Type.BOOLEAN },
              hasRectoEtVerso: { type: Type.BOOLEAN },
              hasMentionLicence: { type: Type.BOOLEAN },
              hasAttestationReussite: { type: Type.BOOLEAN },
              hasEtablissement: { type: Type.BOOLEAN },
              hasAnnee: { type: Type.BOOLEAN },
              hasNom: { type: Type.BOOLEAN },
              hasCne: { type: Type.BOOLEAN },
              hasMentionMasterOuIngenieur: { type: Type.BOOLEAN },
              hasIntituleFiliere: { type: Type.BOOLEAN },
              hasMentionReleveNotes: { type: Type.BOOLEAN },
              hasSemestreS1: { type: Type.BOOLEAN },
              hasSemestreS2: { type: Type.BOOLEAN },
              hasSemestreS3: { type: Type.BOOLEAN },
              hasSemestreS4: { type: Type.BOOLEAN },
              hasNotesOuMoyennes: { type: Type.BOOLEAN },
              hasTitreProjetRecherche: { type: Type.BOOLEAN },
              hasObjectifsOuProblematique: { type: Type.BOOLEAN },
              hasMethodologie: { type: Type.BOOLEAN },
              hasRubriquesCv: { type: Type.BOOLEAN },
              hasCoordonnees: { type: Type.BOOLEAN },
              isScanIllisible: { type: Type.BOOLEAN },
              isTypeIncertain: { type: Type.BOOLEAN },
              extractedCandidate: {
                type: Type.OBJECT,
                properties: {
                  nom: { type: Type.STRING },
                  prenom: { type: Type.STRING },
                  cin: { type: Type.STRING },
                  cne: { type: Type.STRING },
                  date_naissance: { type: Type.STRING },
                  lieu_naissance: { type: Type.STRING },
                  filiere: { type: Type.STRING },
                  email: { type: Type.STRING },
                  titre_sujet: { type: Type.STRING }
                },
                required: [
                  'nom',
                  'prenom',
                  'cin',
                  'cne',
                  'date_naissance',
                  'lieu_naissance',
                  'filiere',
                  'email',
                  'titre_sujet'
                ]
              }
            },
            required: [
              'detectedType',
              'detectedSummary',
              'hasMentionCnie',
              'detectedCinNumber',
              'hasNomEtPrenom',
              'hasDateNaissance',
              'hasDateValidite',
              'hasRectoEtVerso',
              'hasMentionLicence',
              'hasAttestationReussite',
              'hasEtablissement',
              'hasAnnee',
              'hasNom',
              'hasCne',
              'hasMentionMasterOuIngenieur',
              'hasIntituleFiliere',
              'hasMentionReleveNotes',
              'hasSemestreS1',
              'hasSemestreS2',
              'hasSemestreS3',
              'hasSemestreS4',
              'hasNotesOuMoyennes',
              'hasTitreProjetRecherche',
              'hasObjectifsOuProblematique',
              'hasMethodologie',
              'hasRubriquesCv',
              'hasCoordonnees',
              'isScanIllisible',
              'isTypeIncertain',
              'extractedCandidate'
            ]
          }
        }
      });

      const rawText = (response.text ?? '{}').trim();
      const analysis = JSON.parse(rawText);

      return res.json({
        engine: 'GEMINI',
        analysis
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue Gemini';
      console.error('Erreur vérification Gemini document :', errorMsg);
      return res.status(502).json({
        error: 'GEMINI_ERROR',
        message: errorMsg
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
