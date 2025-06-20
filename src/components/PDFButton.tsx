import React, { useState } from "react";

// Props: Passe die Typen ggf. an deine Datenstruktur an!
interface PDFButtonProps {
  workbookData: any[];
  configData: any;
  totalAmount: number;
  showNotification?: (msg: string, type?: 'error'|'info'|'success'|'warning') => void;
}

const PDFButton: React.FC<PDFButtonProps> = ({ workbookData, configData, totalAmount, showNotification }) => {
  const [action, setAction] = useState<'anzeigen' | 'herunterladen'>('herunterladen');

  const handlePDF = async () => {
    // Dynamischer Import: PDF-Code und pdfmake werden nur jetzt geladen!
    const { generatePDF } = await import("../renderer/generatePDF");
    generatePDF(workbookData, configData, totalAmount, showNotification, action);
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button onClick={handlePDF}>
        PDF {action === 'anzeigen' ? 'anzeigen' : 'herunterladen'}
      </button>
      <select value={action} onChange={e => setAction(e.target.value as 'anzeigen' | 'herunterladen')} style={{ height: 28 }}>
        <option value="herunterladen">Herunterladen</option>
        <option value="anzeigen">Anzeigen</option>
      </select>
    </span>
  );
};

export default PDFButton;