" `denops#plugin#wait()`はVimで入力を吸うので自前でそれらしき物を実装する
" 吸うなら吸うで戻せばいいのだ
function s:wait() abort
  let chars = ''
  while !denops#plugin#is_loaded('skkeleton')
    " Note: 吸わないと`<C-c>`の受け付けができないらしい
    let chars ..= getcharstr(0)
    " Note: Neovimではsleepを挟まないとRPCが実行されない
    sleep 1m
  endwhile
  call feedkeys(chars, 'it')
endfunction

function! skkeleton#denops#request(funcname, args) abort
  call s:wait()
  return denops#request('skkeleton', a:funcname, a:args)
endfunction

function! s:send_notify() abort
  for [funcname, args] in s:pending_notify
    call denops#notify('skkeleton', funcname, args)
  endfor
endfunction

function! s:notify_later(funcname, args) abort
  let s:pending_notify = add(get(s:, 'pending_notify', []), [a:funcname, a:args])
  augroup skkeleton-notify
    autocmd!
    autocmd User DenopsPluginPost:skkeleton ++once call s:send_notify()
  augroup END
endfunction

function! skkeleton#denops#request_async(funcname, args) abort
  if denops#plugin#is_loaded('skkeleton')
    call denops#request('skkeleton', a:funcname, a:args)
  else
    call s:notify_later(a:funcname, a:args)
  endif
endfunction

function! skkeleton#denops#notify_async(funcname, args) abort
  if denops#plugin#is_loaded('skkeleton')
    call denops#notify('skkeleton', a:funcname, a:args)
  else
    call s:notify_later(a:funcname, a:args)
  endif
endfunction
