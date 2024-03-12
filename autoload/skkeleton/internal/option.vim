let s:textwidth = {}

function s:ensure(dict, key, value)
  let a:dict[a:key] = get(a:dict, a:key, a:value)
endfunction

function skkeleton#internal#option#save_and_set()
  call s:ensure(s:textwidth, bufnr(), &l:textwidth)
  " 不意に改行が発生してバッファが壊れるため 'textwidth' を無効化
  setlocal textwidth=0
endfunction

function skkeleton#internal#option#restore()
  let bufnr = bufnr()
  if has_key(s:textwidth, bufnr)
    let &l:textwidth = remove(s:textwidth, bufnr)
  endif
endfunction
