function skkeleton#vim#preedit#mkdefault() abort
  return {'current': '', 'kakutei': ''}
endfunction

function skkeleton#vim#preedit#kakutei(preedit, str) abort
  let a:preedit.kakutei ..= a:str
endfunction

function skkeleton#vim#preedit#output(preedit, next) abort
  " TODO: 後で補完対策のやつ入れる
  let ret = repeat("\<BS>", strcharlen(a:preedit.current)) .. a:preedit.kakutei .. a:next
  let a:preedit.current = a:next
  let a:preedit.kakutei = ''
  return ret
endfunction
