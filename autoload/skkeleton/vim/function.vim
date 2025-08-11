let s:functions = #{
\   kanaInput: 'input#kana'
\ }

function skkeleton#vim#function#call(func, context, char) abort
  if has_key(s:functions, a:func)
    call skkeleton#vim#function#{s:functions[a:func]}(a:context, a:char)
  endif
  echo 'function call' a:func
endfunction
