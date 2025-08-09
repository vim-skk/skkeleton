function skkeleton#vim#mkcontext() abort
  let context = {}
  let context.state = skkeleton#vim#state#mkdefault()
  let context.preedit = skkeleton#vim#preedit#mkdefault()
  return context
endfunction

let g:skkeleton#vim#initialized = v:false
let g:skkeleton#vim#context = skkeleton#vim#mkcontext()

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
  let state = g:skkeleton#vim#context.state
  if state.type !=# 'input' || state.mode !=# 'direct'
    return s:handler.handle(a:opts)
  endif
  doautocmd <nomodeline> User skkeleton-enable-pre

  call skkeleton#internal#option#save_and_set()
  call skkeleton#map()
  let g:skkeleton#enable = v:true
  doautocmd <nomodeline> User skkeleton-enable-post
  return ''
endfunction

function s:handler.handleKey(opts) abort
  let context = g:skkeleton#vim#context
  " TODO: normalize key
  if has_key(a:opts, 'function')
    let f = a:opts.function
    for k in a:opts.key
      call skkeleton#vim#function#call(f, context, k)
    endfor
  else
    for k in a:opts.key
      call skkeleton#vim#keymap#handle(context, k)
    endfor
  endif
  " TODO: contextというかstateのtostring実装する
  let state_string = skkeleton#vim#state#to_string(context.state)
  return skkeleton#vim#preedit#output(context.preedit, state_string)
endfunction

function skkeleton#vim#handle(func, opts) abort
  " TODO: 補完用リセットを書く
  let result = s:handler[a:func](a:opts)
  let state = g:skkeleton#vim#context.state
  let stateview = {}
  if state.type ==# 'input'
    if state.mode ==# 'okurinasi'
      let stateview.phase = 'input:okurinasi'
    elseif state.mode ==# 'okuriari'
      let stateview.phase = 'input:okuriari'
    else
      let stateview.phase = 'input'
    endif
  else
    let stateview.phase = state.type
  endif
  return #{result: result, state: stateview}
endfunction
