function s:init() abort
  let n2k = {}
  let n2k['<nul>'] = "\<nul>"
  let n2k['<bs>'] = "\<bs>"
  let n2k['<tab>'] = "\<tab>"
  let n2k['<s-tab>'] = "\<s-tab>"
  let n2k['<nl>'] = "\<nl>"
  let n2k['<ff>'] = "\<ff>"
  let n2k['<cr>'] = "\<cr>"
  let n2k['<return>'] = "\<return>"
  let n2k['<enter>'] = "\<enter>"
  let n2k['<esc>'] = "\<esc>"
  let n2k['<space>'] = "\<space>"
  let n2k['<s-space>'] = "\<space>"
  let n2k['<c-space>'] = "\<space>"
  let n2k['<lt>'] = "\<lt>"
  let n2k['<bslash>'] = "\<bslash>"
  let n2k['<bar>'] = "\<bar>"
  let n2k['<del>'] = "\<del>"
  let n2k['<csi>'] = "\<csi>"
  let n2k['<xcsi>'] = "\<xcsi>"
  let n2k['<eol>'] = "\<eol>"
  let n2k['<ignore>'] = "\<ignore>"
  let n2k['<nop>'] = "\<nop>"
  let n2k['<up>'] = "\<up>"
  let n2k['<down>'] = "\<down>"
  let n2k['<left>'] = "\<left>"
  let n2k['<right>'] = "\<right>"
  let n2k['<s-up>'] = "\<s-up>"
  let n2k['<s-down>'] = "\<s-down>"
  let n2k['<s-left>'] = "\<s-left>"
  let n2k['<s-right>'] = "\<s-right>"
  let n2k['<c-left>'] = "\<c-left>"
  let n2k['<c-right>'] = "\<c-right>"
  let n2k['<help>'] = "\<help>"
  let n2k['<undo>'] = "\<undo>"
  let n2k['<insert>'] = "\<insert>"
  let n2k['<home>'] = "\<home>"
  let n2k['<end>'] = "\<end>"
  let n2k['<pageup>'] = "\<pageup>"
  let n2k['<pagedown>'] = "\<pagedown>"
  let n2k['<kup>'] = "\<kup>"
  let n2k['<kdown>'] = "\<kdown>"
  let n2k['<kleft>'] = "\<kleft>"
  let n2k['<kright>'] = "\<kright>"
  let n2k['<khome>'] = "\<khome>"
  let n2k['<kend>'] = "\<kend>"
  let n2k['<korigin>'] = "\<korigin>"
  let n2k['<kpageup>'] = "\<kpageup>"
  let n2k['<kpagedown>'] = "\<kpagedown>"
  let n2k['<kdel>'] = "\<kdel>"
  let n2k['<kplus>'] = "\<kplus>"
  let n2k['<kminus>'] = "\<kminus>"
  let n2k['<kmultiply>'] = "\<kmultiply>"
  let n2k['<kdivide>'] = "\<kdivide>"
  let n2k['<kpoint>'] = "\<kpoint>"
  let n2k['<kcomma>'] = "\<kcomma>"
  let n2k['<kequal>'] = "\<kequal>"
  let n2k['<kenter>'] = "\<kenter>"
  for i in range(1, 12)
    execute printf('let n2k["<f%s>"] = "\<f%s>"', i, i)
    execute printf('let n2k["<s-f%s>"] = "\<s-f%s>"', i, i)
  endfor
  for i in range(0, 9)
    execute printf('let n2k["<k%s>"] = "\<k%s>"', i, i)
  endfor
  for i in range(26)
    let c = nr2char(i + 97)
    execute printf('let n2k["<s-%s>"] = "\<s-%s>"', c, c)
    execute printf('let n2k["<c-%s>"] = "\<c-%s>"', c, c)
    execute printf('let n2k["<m-%s>"] = "\<m-%s>"', c, c)
    execute printf('let n2k["<a-%s>"] = "\<a-%s>"', c, c)
    execute printf('let n2k["<d-%s>"] = "\<d-%s>"', c, c)
  endfor
  let g:skkeleton#notation#notation_to_key = n2k

  let k2n = {}
  for n in keys(n2k)
     let k2n[n2k[n]] = n
  endfor
  let g:skkeleton#notation#key_to_notation = k2n
endfunction

call s:init()
