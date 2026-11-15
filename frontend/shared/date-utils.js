// Shared date and time formatting utilities for the IPSRS frontend.
// Preserve the legacy global function names while extracting pure helpers from app.js.
(function(global){
  'use strict';

  function formatLoginDateTime_(value){
    if(!value) return 'Belum pernah login';
    const d=new Date(value);
    if(Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }

  function formatLastSeen_(value){
    if(!value) return '-';
    const d=new Date(value), now=Date.now(), sec=Math.max(0,Math.floor((now-d.getTime())/1000));
    if(sec<60) return sec+' detik lalu';
    const minTotal=Math.floor(sec/60);
    const hourTotal=Math.floor(minTotal/60);
    const dayTotal=Math.floor(hourTotal/24);
    if(hourTotal<24){
      if(hourTotal===0) return minTotal+' menit lalu';
      const mins=minTotal%60;
      return hourTotal+' jam'+(mins ? ' '+mins+' menit' : '')+' lalu';
    }
    const hours=hourTotal%24;
    const mins=minTotal%60;
    return dayTotal+' hari'+(hours ? ' '+hours+' jam' : '')+(mins ? ' '+mins+' menit' : '')+' lalu';
  }

  // Browser-local date, matching the legacy function and avoiding UTC date shifts.
  function todayLocalISO(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }

  function formatTanggalDisplay(value){
    if(value === undefined || value === null || value === '') return '';
    const text = String(value).trim();
    const isoDateTimeMatch = text.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/);
    if(isoDateTimeMatch){
      const d = new Date(text);
      if(!Number.isNaN(d.getTime())){
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric'
        }).formatToParts(d);
        const get = type => parts.find(p => p.type === type)?.value || '';
        return get('day') + '/' + get('month') + '/' + get('year');
      }
    }
    const isoDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(isoDateMatch) return isoDateMatch[3] + '/' + isoDateMatch[2] + '/' + isoDateMatch[1];
    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(slashMatch) return slashMatch[1].padStart(2,'0') + '/' + slashMatch[2].padStart(2,'0') + '/' + slashMatch[3];
    return text;
  }

  global.formatLoginDateTime_ = formatLoginDateTime_;
  global.formatLastSeen_ = formatLastSeen_;
  global.todayLocalISO = todayLocalISO;
  global.formatTanggalDisplay = formatTanggalDisplay;
})(window);
