// Shared DOM utilities used by all frontend feature modules.
// Keep these as classic-script globals for backward compatibility with inline handlers
// and existing modules while the application is migrated incrementally.
(function(global){
  'use strict';

  function escapeHtml(str){
    return (str===undefined||str===null?'':String(str))
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Shared empty-state markup. The caller remains responsible for supplying
  // trusted/escaped text, matching the legacy app.js contract exactly.
  function emptyStateHtml(text){
    return '<div class="empty-state">'
      + '<svg class="es-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"></path></svg>'
      + '<div class="es-text">' + text + '</div>'
      + '</div>';
  }

  global.escapeHtml = escapeHtml;
  global.emptyStateHtml = emptyStateHtml;
})(window);
