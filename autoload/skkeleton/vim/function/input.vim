" /data/code/vim/skkeleton/skkeleton/denops/skkeleton/kana.ts
function skkeleton#vim#function#input#kana(context, char) abort
  let state = a:context.state
  let state.type = 'input'

  " TODO: AIに書かせたやつなので後で書き直す
  " let lower = has_key(g:config.lowercaseMap, a:char) ? g:config.lowercaseMap[a:char] : tolower(a:char)
  " if !get(state, 'directInput', 0) && a:char !=# lower
  "   let withShift = '<s-' . lower . '>'
  "   let found = 0
  "   for entry in state.table
  "     if entry[0] =~? '^' . state.feed . withShift
  "       let found = 1
  "       break
  "     endif
  "   endfor
  "   if found
  "     let char = withShift
  "   else
  "     call HenkanPoint(a:context)
  "     call KanaInput(a:context, lower)
  "     return
  "   endif
  " endif

  let next = state.feed .. a:char
  let found = state.table->copy()->filter('stridx(v:val[0], next) == 0')
  echomsg next found

  if len(found) == 1 && found[0][0] ==# next
    " 正確にマッチした場合はそのまま確定
    echo 'AcceptResult'
    " call AcceptResult(a:context, found[1][1], next)
  elseif len(found) > 0
    " テーブルに残余があったらfeedに積む
    let state.feed = next
  elseif state.feed !=# ''
    let current = get(state.table, indexof(table, {->v:val[0] ==# state.feed}), v:null)
    " let current = filter(copy(state.table), {_, v -> v[0] ==# state.feed})
    if !empty(current)
      " call AcceptResult(a:context, current[0][1], next)
      echo 'AcceptResult'
    elseif get({}, 'acceptIllegalResult', 0)
      " TODO: config生やそうな
      " call KakuteiKana(state, a:context.preEdit, state.feed, '')
    else
      let state.feed = ''
    endif
    call skkeleton#vim#function#input#kana(a:context, a:char)
  else
    " call KakuteiKana(state, a:context.preEdit, a:char, '')
    echo 'KakuteiKana'
  endif
endfunction
	
