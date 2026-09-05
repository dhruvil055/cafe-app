export const downloadPdf = (data, filename) => {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoking on the same tick can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
