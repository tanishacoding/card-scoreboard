// Close bottom sheet on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('sheetOverlay');
    if (overlay && overlay.classList.contains('open')) {
      overlay.classList.remove('open');
      document.getElementById('bottomSheet')?.classList.remove('open');
    }
  }
});
