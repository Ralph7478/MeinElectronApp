import React, { useRef } from 'react';
import * as XLSX from 'xlsx';

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);
      alert(JSON.stringify(json, null, 2));
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div>
      <h1>Excel Reader</h1>
      <input type="file" accept=".xlsx,.xls" ref={inputRef} onChange={handleFile} />
    </div>
  );
}