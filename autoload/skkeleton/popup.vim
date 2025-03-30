let s:windows = []

function! skkeleton#popup#open(candidates) abort
  let s:candidates = a:candidates
  autocmd skkeleton-internal User skkeleton-handled ++once call s:open(s:candidates)
endfunction

function! s:open_cmdline(candidates)
  let top = &lines + 1 - max([1, &cmdheight]) - len(a:candidates)
  if has('nvim')
    let buf = nvim_create_buf(v:false, v:true)
    call nvim_buf_set_lines(buf, 0, -1, v:true, a:candidates)
    let opts = {
          \ 'border': 'none',
          \ 'relative': 'editor',
          \ 'width': max(map(copy(a:candidates), 'strwidth(v:val)')),
          \ 'height': len(a:candidates),
          \ 'col': getcmdscreenpos(),
          \ 'row': top,
          \ 'style': 'minimal',
          \ }
    let win = nvim_open_win(buf, 0, opts)
    redraw
    call add(s:windows, win)
  else
    let id = popup_create(a:candidates, {
    \ 'line': top,
    \ 'col': getcmdscreenpos(),
    \ })
    call add(s:windows, id)
  endif
endfunction

function! s:open(candidates) abort
  autocmd skkeleton-internal User skkeleton-handled ++once call skkeleton#popup#close()
  if mode() == 'c'
    call s:open_cmdline(a:candidates)
    return
  endif
  let spos = screenpos(0, line('.'), col('.'))
  " Note: Neovimではecho areaにfloatwinを被せるのが許可されておらず、ずれるため
  "       offset付けることで弾く
  let offset = has('nvim') ? &cmdheight : 0
  let linvert = &lines - spos.row - offset < a:candidates->len()
  if has('nvim')
    let buf = nvim_create_buf(v:false, v:true)
    call nvim_buf_set_lines(buf, 0, -1, v:true, a:candidates)
    let opts = {
          \ 'border': 'none',
          \ 'relative': 'cursor',
          \ 'width': max(map(copy(a:candidates), 'strwidth(v:val)')),
          \ 'height': len(a:candidates),
          \ 'col': 0,
          \ 'row': linvert ? 0 : 1,
          \ 'anchor': linvert ? 'SW' : 'NW',
          \ 'style': 'minimal',
          \ }
    let win = nvim_open_win(buf, 0, opts)
    call add(s:windows, win)
  else
    let id = popup_create(a:candidates, {
          \ 'pos': linvert ? 'botleft' : 'topleft',
          \ 'line': linvert ? 'cursor-1' : 'cursor+1',
          \ 'col': 'cursor',
          \ })
    call add(s:windows, id)
  endif
endfunction

function! skkeleton#popup#close() abort
  if has('nvim')
    for i in s:windows
      call nvim_win_close(i, v:true)
    endfor
  else
    for i in s:windows
      call popup_close(i)
    endfor
  endif
  let s:windows = []
endfunction
