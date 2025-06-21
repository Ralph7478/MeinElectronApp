import React from "react";

// Props: Passe die Typen ggf. an deine Datenstruktur an!
interface PDFButtonProps {
  workbookData: any[];
  configData: any;
  totalAmount: number;
  showNotification?: (msg: string, type?: 'error'|'info'|'success'|'warning') => void;
  action: 'anzeigen' | 'herunterladen';
}

const PDFButton: React.FC<PDFButtonProps> = ({ workbookData, configData, totalAmount, showNotification, action }) => {
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
    </span>
  );
};

export default PDFButton;