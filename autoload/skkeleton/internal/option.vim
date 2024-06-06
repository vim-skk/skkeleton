let s:textwidth = {}
let s:virtualedit = {}

function s:ensure(dict, key, value)
  let a:dict[a:key] = get(a:dict, a:key, a:value)
endfunction

function skkeleton#internal#option#save_and_set()
  " cmdline関係ないオプションだけなので辞書登録時はスキップ
  if mode() !=# 'c'
    call skkeleton#internal#option#restore()
  endif
  call s:ensure(s:textwidth, bufnr(), &l:textwidth)
  call s:ensure(s:virtualedit, win_getid(), &l:virtualedit)
  " 不意に改行が発生してバッファが壊れるため 'textwidth' を無効化
  setlocal textwidth=0
  " 末尾で送りあり変換をした際にバッファが壊れるため、一時的に 'virtualedit' を使う
  setlocal virtualedit=all
endfunction

function skkeleton#internal#option#restore()
  let bufnr = bufnr()
  let winid = win_getid()
  if has_key(s:textwidth, bufnr)
    let &l:textwidth = remove(s:textwidth, bufnr)
  endif
  if has_key(s:virtualedit, winid)
    let &l:virtualedit = remove(s:virtualedit, winid)
  endif
endfunction
