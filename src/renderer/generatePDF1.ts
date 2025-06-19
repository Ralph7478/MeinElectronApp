function formatEuro(value) {
  let num = parseFloat(String(value).replace(',', '.'));
  if (isNaN(num)) num = 0;
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatGermanDateTime(dateString) {
  let date = typeof dateString === "string" ? new Date(dateString) : dateString;
  const pad = n => n.toString().padStart(2, '0');
  return (
    pad(date.getDate()) + '.' +
    pad(date.getMonth() + 1) + '.' +
    date.getFullYear() + ' ' +
    pad(date.getHours()) + ':' +
    pad(date.getMinutes()) + ':' +
    pad(date.getSeconds())
  );
}

function formatGermanDate(dateString) {
  let date = typeof dateString === "string" ? new Date(dateString) : dateString;
  const pad = n => n.toString().padStart(2, '0');
  return (
    pad(date.getDate()) + '.' +
    pad(date.getMonth() + 1) + '.' +
    date.getFullYear()
  );
}

function splitVerwendungszweck(text) {
  if (!text) return "";
  text = text.slice(0, 140); // maximal 140 Zeichen
  const maxLength = 70;
  if (text.length <= maxLength) return text;

  let idx = text.lastIndexOf(' ', maxLength);
  if (idx === -1) idx = maxLength;
  return text.slice(0, idx) + '\n' + text.slice(idx).trim();
}

function formatEndToEndId(text) {
  return text ? text.slice(0, 35) : '';
}

function generatePDF() {
  if (!workbookData || !configData) {
    alert('Bitte Excel-Datei zuerst laden.');
    return;
  }

  const msgId = configData.MSGID || '';
  const creDtTm = new Date();
  const valutaDate = (workbookData[0] && workbookData[0].Valuta)
    ? formatGermanDate(workbookData[0].Valuta)
    : formatGermanDate(new Date());

  const header = [
    { text: 'Erfassungsprotokoll: Zahlungen', style: 'header', margin: [0, 0, 0, 5] },
    { text: `Sammler: ${msgId}`, style: 'subheader', margin: [0, 0, 0, 1] },
    { text: `Erfassung: ${formatGermanDateTime(creDtTm)}`, style: 'subheader', margin: [0, 0, 0, 1] },
    { text: `Valuta: ${valutaDate}`, style: 'valuta', margin: [0, 0, 0, 1] },
    { text: `Auftraggeber: ${configData.AuftraggeberName || ''}`, style: 'meta', margin: [0, 0, 0, 1] },
    { text: `IBAN: ${configData.AuftraggeberIBAN || ''}`, style: 'meta', margin: [0, 0, 0, 1] },
    { text: `BIC: ${configData.AuftraggeberBIC || ''}`, style: 'meta', margin: [0, 0, 0, 8] },
  ];

  const tableBody = [
    [
      { text: 'Nr.', style: 'tableHeader' },
      { text: 'Empfänger & IBAN', style: 'tableHeader' },
      { text: 'Verwendungszweck', style: 'tableHeader' },
      { text: 'EndToEndId', style: 'tableHeader' },
      { text: 'Betrag', style: 'tableHeader', alignment: 'right', margin: [0,0,12,0] }
    ]
  ];

  workbookData.forEach((row, i) => {
    const empfaenger = row.Empfaenger?.trim() || '';
    const iban = row.IBAN?.trim() || '';
    const bic = row.BIC?.trim() || '';
    const empfaengerIbanText = empfaenger + '\n' + iban + (bic ? ' ' + bic : '');

    tableBody.push([
      { text: (i + 1).toString(), style: 'tableCell' },
      { text: empfaengerIbanText, style: 'tableCell', lineHeight: 1.1 },
      { text: splitVerwendungszweck(row.Verwendungszweck || ''), style: 'vwzCell' },
      { text: formatEndToEndId(row.EndToEndId || ''), style: 'tableCell' },
      { text: formatEuro(row.Betrag), style: 'tableCell', alignment: 'right', margin: [0,0,12,0] }
    ]);
  });

  tableBody.push([
    { text: '', style: 'tableCell' },
    { text: '', style: 'tableCell' },
    { text: '', style: 'tableCell' },
    { text: { text: 'Summe:', bold: true }, alignment: 'right', style: 'tableHeader' },
    { text: formatEuro(totalAmount), style: 'tableHeader', alignment: 'right', margin: [0,0,12,0] }
  ]);

  const docDefinition = {
    pageOrientation: 'landscape',
    pageSize: 'A4',
    pageMargins: [18, 30, 18, 25],
    footer: function(currentPage, pageCount) {
      return {
        columns: [
          { text: `Erstellt: ${formatGermanDateTime(creDtTm)}`, alignment: 'left', fontSize: 7, margin: [4, 0, 0, 0] },
          { text: `Datei: Erfassungsprotokoll_${msgId}.pdf`, alignment: 'center', fontSize: 7 },
          { text: `Seite ${currentPage} von ${pageCount}`, alignment: 'right', fontSize: 7, margin: [0, 0, 4, 0] }
        ],
        margin: [18, 0, 18, 0]
      };
    },
    content: [
      ...header,
      {
        table: {
          headerRows: 1,
          widths: [22, 150, 210, 90, 101],
          body: tableBody
        },
        layout: 'lightHorizontalLines'
      }
    ],
    styles: {
      header: { fontSize: 12, bold: true },
      subheader: { fontSize: 9 },
      valuta: { fontSize: 8, bold: true },
      meta: { fontSize: 8, color: '#555' },
      tableHeader: { bold: true, fillColor: '#eeeeee', fontSize: 9 },
      tableCell: { fontSize: 8 },
      vwzCell: { fontSize: 8, lineHeight: 1.1 }
    }
  };

  pdfMake.createPdf(docDefinition).download(`Erfassungsprotokoll_${msgId}.pdf`);
}
