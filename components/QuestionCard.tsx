import React from 'react';
import type { Question } from '../types';
import { convertToDirectGoogleDriveLink } from '../utils/imageUtils';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedOption: string | undefined;
  onAnswer: (questionId: string, optionId: string) => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionNumber,
  totalQuestions,
  selectedOption,
  onAnswer,
}) => {
  const directImageUrl = convertToDirectGoogleDriveLink(question.imageUrl);

  return (
    <div>
      <p className="text-sm font-semibold text-gray-500 mb-2">
        Câu {questionNumber} trên {totalQuestions}
      </p>
      {directImageUrl && (
        <div className="my-4 flex justify-center">
            <img 
                src={directImageUrl} 
                alt={`Hình minh họa cho câu hỏi ${questionNumber}`}
                className="max-w-full h-auto max-h-80 rounded-lg shadow-md object-contain border border-gray-200"
            />
        </div>
      )}
      <div
        className="text-lg text-gray-900 prose max-w-none mb-6"
        dangerouslySetInnerHTML={{ __html: question.stem }}
      />
      <div className="space-y-4">
        {question.options.map((option, index) => (
          <label
            key={option.id}
            className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
              selectedOption === option.id
                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                : 'border-gray-300 bg-white hover:border-indigo-400'
            }`}
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option.id}
              checked={selectedOption === option.id}
              onChange={() => onAnswer(question.id, option.id)}
              className="sr-only"
              aria-labelledby={`option-text-${option.id}`}
            />
            <span
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-4 border-2 ${
                selectedOption === option.id
                  ? 'border-indigo-500 bg-indigo-500'
                  : 'border-gray-400 bg-white'
              }`}
            >
              {selectedOption === option.id && <div className="w-2.5 h-2.5 rounded-full bg-white"></div>}
            </span>
            <span className="font-semibold text-gray-700 mr-2">{String.fromCharCode(65 + index)}.</span>
            <span id={`option-text-${option.id}`} className="text-gray-800 flex-grow">{option.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default QuestionCard;
