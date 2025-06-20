import React from "react";

// Props: Passe die Typen ggf. an deine Datenstruktur an!
interface PDFButtonProps {
  workbookData: any[];
  configData: any;
  totalAmount: number;
}

const PDFButton: React.FC<PDFButtonProps> = ({ workbookData, configData, totalAmount }) => {
  const handlePDF = async () => {
    // Dynamischer Import: PDF-Code und pdfmake werden nur jetzt geladen!
    const { generatePDF } = await import("../renderer/generatePDF");
    generatePDF(workbookData, configData, totalAmount);
  };

  return (
    <button onClick={handlePDF}>
      PDF erzeugen
    </button>
  );
};

export default PDFButton;