// Pure item-name normalization and similarity helpers used by the Item Baru flow.
(function(global){
  'use strict';

  function normalizeLiveItem_(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('id').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }

  function liveLevenshteinScore_(a,b){
    if(a===b)return 1;
    if(!a.length||!b.length)return 0;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const cur=[i];
      for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      prev=cur;
    }
    return 1-prev[b.length]/Math.max(a.length,b.length,1);
  }

  global.normalizeLiveItem_ = normalizeLiveItem_;
  global.liveLevenshteinScore_ = liveLevenshteinScore_;
})(window);
