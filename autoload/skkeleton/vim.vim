let g:skkeleton#vim#initialized = v:false
let g:skkeleton#vim#state = skkeleton#vim#state#mkdefault()
let g:skkeleton#vim#preedit = ''

function s:init() abort
  if g:skkeleton#vim#initialized
    return
  endif
  doautocmd <nomodeline> User skkeleton-initialized-pre
  augroup skkeleton-internal-vim
    autocmd!
    autocmd ModeChanged *:[ic]* let g:skkeleton#vim#state = skkeleton#vim#state#mkdefault()
    autocmd ModeChanged *:[ic]* call skkeleton#disable()
  augroup END
  doautocmd <nomodeline> User skkeleton-initialized-post
  let g:skkeleton#vim#initialized = v:true
endfunction

let s:handler = {}

function s:handler.enable(opts) abort
  call s:init()
  if mode() ==# 'R'
    echoerr "skkeleton doesn't allowed in replace mode"
    return ''
  endif
  if g:skkeleton#vim#state.type !=# 'input' || g:skkeleton#vim#state.mode !=# 'direct'
    return s:handler.handle(a:opts)
  endif
  doautocmd <nomodeline> User skkeleton-enable-pre
  
  call skkeleton#internal#option#save_and_set()
  call skkeleton#map()
  doautocmd <nomodeline> User skkeleton-enable-post
  return ''
endfunction

function s:handler.handle(opts) abort
endfunction

function skkeleton#vim#handle(func, opts) abort
  " TODO: 補完用リセットを書く
  let result = s:handler[a:func](a:opts)
  let state = g:skkeleton#vim#state->deepcopy()
  return #{result: result, state: state}
endfunction
