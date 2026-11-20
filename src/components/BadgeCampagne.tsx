import React from 'react';
import { VersionCampagne } from '../types';
import { getCampagneBadge } from '../utils/dateUtils';
import { Check, Clock } from 'lucide-react';

interface BadgeCampagneProps {
  campagne: VersionCampagne;
  className?: string;
  showIcon?: boolean;
}

export const BadgeCampagne: React.FC<BadgeCampagneProps> = ({
  campagne,
  className = '',
  showIcon = true
}) => {
  const badge = getCampagneBadge(campagne);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-bold border transition-colors shadow-2xs ${
        badge.estOuverte 
          ? 'bg-emerald-50 text-[#16a34a] border-emerald-300' 
          : 'bg-rose-50 text-rose-700 border-rose-300'
      } ${className}`}
      title={badge.estOuverte ? `Date limite : ${campagne.date_cloture}` : 'La période de candidature est close'}
    >
      {showIcon && (
        badge.estOuverte ? (
          <Check className="w-3.5 h-3.5 text-[#16a34a] stroke-[2.5] shrink-0" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        )
      )}
      <span>{badge.texte}</span>
    </span>
  );
};
