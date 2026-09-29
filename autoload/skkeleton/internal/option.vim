let s:textwidth = {}
let s:virtualedit = {}

augroup skkeleton-internal-option
  autocmd!
  autocmd BufWipeout * call skkeleton#internal#option#discard_buffer(str2nr(expand('<abuf>')))
  autocmd WinClosed * call skkeleton#internal#option#discard_window(str2nr(expand('<afile>')))
augroup END

function! skkeleton#internal#option#discard_buffer(bufnr) abort
  silent! unlet s:textwidth[a:bufnr]
endfunction

function! skkeleton#internal#option#discard_window(winid) abort
  silent! unlet s:virtualedit[a:winid]
endfunction

function s:ensure(dict, key, value)
  let a:dict[a:key] = get(a:dict, a:key, a:value)
endfunction

function skkeleton#internal#option#save_and_set()
  " cmdline関係ないオプションだけなのでcmdlineでは飛ばす
  if mode() ==# 'c'
    return
  endif
  call s:ensure(s:textwidth, bufnr(), &l:textwidth)
  call s:ensure(s:virtualedit, win_getid(), &l:virtualedit)
  " 不意に改行が発生してバッファが壊れるため 'textwidth' を無効化
  setlocal textwidth=0
  " 末尾で送りあり変換をした際にバッファが壊れるため、一時的に 'virtualedit' を使う
  setlocal virtualedit=onemore
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
