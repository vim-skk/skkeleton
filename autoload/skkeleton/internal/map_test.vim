" so %
" TODO: rewrite with test framework

function s:assert_equal(expected, actual)
  let v:errors = []
  if assert_equal(a:expected, a:actual)
    throw v:errors[0]
  endif
endfunction

source <script>:h/map.vim

nmapclear <buffer>
nnoremap <buffer> a b
call skkeleton#internal#map#save('n')
nnoremap <buffer> b a
call s:assert_equal(2, execute('nnoremap <buffer>')->split('\n')->len())
call skkeleton#internal#map#restore()
call s:assert_equal(1, execute('nnoremap <buffer>')->split('\n')->len())


