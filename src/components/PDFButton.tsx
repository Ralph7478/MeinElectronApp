import React from "react";
import { useDataContext } from '../renderer/DataContext';

// Props: Passe die Typen ggf. an deine Datenstruktur an!
interface PDFButtonProps {
  totalAmount: number;
  showNotification?: (msg: string, type?: 'error'|'info'|'success'|'warning') => void;
}

const PDFButton: React.FC<PDFButtonProps> = ({ totalAmount, showNotification }) => {
  const { workbookData, configData } = useDataContext();
  const handlePDF = async () => {
    // Dynamischer Import: PDF-Code und pdfmake werden nur jetzt geladen!
    const { generatePDF } = await import("../renderer/generatePDF");
    generatePDF(totalAmount, showNotification);
  };

  return (
    <button onClick={handlePDF}>
      PDF erzeugen
    </button>
  );
};

export default PDFButton;