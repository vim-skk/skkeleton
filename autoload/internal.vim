function! skkeleton#internal#disable()
  if g:skkeleton#enabled
    doautocmd <nomodeline> User skkeleton-disable-pre
    call skkeleton#internal#map#restore()
    call skkeleton#internal#option#restore()
    let g:skkeleton#mode = ''
    doautocmd <nomodeline> User skkeleton-mode-changed
    doautocmd <nomodeline> User skkeleton-disable-post
    let g:skkeleton#enabled = v:false
  endif
endfunction
