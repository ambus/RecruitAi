
import React from 'react';

interface RatingScaleProps {
  value: number;
  onChange: (val: number) => void;
}

const RatingScale: React.FC<RatingScaleProps> = ({ value, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((num) => (
        <button
          key={num}
          onClick={() => onChange(num)}
          className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center font-bold ${
            value === num
              ? 'bg-blue-600 border-blue-600 text-white scale-110 shadow-lg'
              : 'border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-400'
          }`}
        >
          {num}
        </button>
      ))}
    </div>
  );
};

export default RatingScale;
