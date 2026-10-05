import { useState } from 'react';

export default function TestModal({ isOpen, onClose, onLogin }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[26px] bg-white p-6 shadow-2xl">
        <h2 className="font-display text-2xl font-bold text-espresso-900">Test Modal</h2>
        <button onClick={onClose} className="mt-4 btn-primary">Close</button>
      </div>
    </div>
  );
}