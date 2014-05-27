(function($, undefined){
  var arraySlice = Array.prototype.slice,
  default_opts = {
    display_mode: 'book',
    curPageIndex: 1,
    zoom: 1,
    show_selector_fac: 0.5
  },
  dhtml_global = {
    screen_width: function()
    {
      return $(window).width();
    }, 
    screen_height: function()
    {
      return $(window).height();
    }, 
    canvas_width: function()
    {
      return this.width() || this.prop('width');
    },
    canvas_height: function()
    {
      return this.height() || this.prop('height');
    }
  };
  function wrpFunc(func, thisarg, prepend_args, append_args)
  {
    return function()
    {
      var args = arraySlice.call(arguments);
      return func.apply(thisarg || this, 
                 prepend_args ? prepend_args.concat(args, append_args) :
                                args.concat(append_bargs));
    }
  }
  function funcListCall(a)
  {
    for(var i = 0, l = a.length; i < l; ++i)
    {
      var item = a[i];
      item[1].apply(item[0], item.slice(2));
    }
  }
  function pdf_viewport_for_canvas(view, rect, type)
  {
    var canv_w = rect.width,
    canv_h = rect.height,
    page_w = view[2],
    page_h = view[3],
    b = page_w / page_h > canv_w / canv_h,
    scale;
    switch(type)
    {
    case 'fill':
      scale = b ? canv_h/page_h : canv_w/page_w;
      break;
    default:
      scale = !b ? canv_h/page_h : canv_w/page_w;
    }
    var offx = (canv_w - page_w * scale) / 2 + (rect.x || 0),
    offy = (canv_h - page_h * scale) / 2 + (rect.y || 0);
    return new PDFJS.PageViewport(view, scale, 0, offx, offy);
  }
  function on(el, releaser)
  {
    el.on.apply(el, arraySlice.call(arguments, 2));
    if(releaser)
      releaser.push(([ el, 'off' ]).concat(arraySlice.call(arguments, 2)));
    return wrpFunc(arguments.callee, null, [ el, releaser ]);
  }
  function get_render_pages(doc, canvas, cb)
  {
    function getPage(i, cb)
    {
      doc.getPage(i).then(function(res) { cb(null, res); }).catch(cb);
    }
    function makeRect(pages)
    {
      switch(o.display_mode)
      {
      case 'book':
        var req_size = [ 0, 0, 0, 0 ],
        len = 0;
        $.each(pages, function(i, page)
          {
            if(page.docPage)
            {
              var view = page.docPage.view;
              req_size[2] += view[2];
              req_size[3] = Math.max(view[3], req_size[3]);
              len++;
            }
          });
        if(len == 1)
          req_size[2] *= 2;
        var vp = pdf_viewport_for_canvas(req_size, canvas, 'fit');
        pages.viewport = vp;
        $.each(pages, function(i, page)
          {
            var view;
            if(page.docPage)
              view = page.docPage.view;
            else
              view = [ 0, 0, vp.width / 2, vp.height ];
            var rect = {
              x: vp.offsetX + (vp.width / 2) * i,
              y: vp.offsetY,
              width: vp.width / 2,
              height: vp.height
            };
            page.viewport = pdf_viewport_for_canvas(view, rect, 'fit');
          });
        break;
      case 'portrait':
        pages[0].viewport = pdf_viewport_for_canvas(pages[0].docPage.view, 
                                                    canvas, 'fit');
        pages.viewport = pages[0].viewport;
        break;
      }
    }
    var self = this,
    o = self.data(pvobj_key),
    cmds = [],
    ret = [],
    getPages = [];
    switch(o.display_mode)
    {
    case 'book':
      var page_idx = o.curPageIndex - (o.curPageIndex % 2 === 0 ? 1 : 0);
      for(var i = 0; i < 2; ++i)
        ret.push({ index: page_idx + i });
      break;
    case 'portrait':
      ret.push({ index: o.curPageIndex });
      break;
    }
    $.each(ret, function(i, p)
      {
        if(p.index > 0 && p.index <= doc.numPages)
          getPages.push(p.index);
      });
    async.map(getPages, getPage, function(err, pages)
      {
        if(err)
          return cb && cb(err);
        var pidx = $.map(pages, function(p) { return p.pageNumber; });
        for(var i = 0, l = ret.length; i < l; ++i)
        {
          var page = ret[i],
          idx = pidx.indexOf(page.index);
          if(idx != -1)
            page.docPage = pages[idx];
        }
        makeRect(ret);
        cb && cb(null, ret);
      });
  }
  function selector_update_active_pages()
  {
    var self = this,
    o = self.data(pvobj_key),
    $el = self.find('.page-selector'),
    pages;
    if(o._curPages)
      pages = $.map(o._curPages, function(page) { return page.index });
    $el.find('.page-item').each(function()
      {
        var $this = $(this),
        idx = parseInt($this.data('page-num'));
        $this.toggleClass('active', pages.indexOf(idx) != -1);
      });  
  }
  function update_canvas_object(doc, canvas, cb)
  {
    var self = this,
    o = self.data(pvobj_key);
    if(o.cancelRender)
      return o.cancelRender(function()
        {
          self.pdfviewer('update_canvas_object', doc, canvas);
        });
    var $canvas = $(canvas);
    $canvas.dhtml('item_update', dhtml_global_object(o));
    o.cancelRender = function(cb)
    {
      if(renderTask && renderTask.cancel && !canceled)
        renderTask.cancel()
      oncancelEnd = function()
      {
        o.cancelRender = null;
        cb();
      };
      canceled = true;
    }
    var operation_complete = function(cb, err)
    {
      if(canceled)
        return oncancelEnd && oncancelEnd();
      renderTask = null;
      var args = arraySlice.call(arguments, 1);
      cb.apply(null, args);
    },
    canceled,
    renderTask,
    oncancelEnd;
    async.waterfall([
      function(next)
      {
        get_render_pages.call(self, doc, canvas, function(err, pages)
          {
            o._curPages = pages;
            operation_complete(next, err, pages);
          });
      },
      function(pages, next)
      {
        if(canceled)
          return oncancelEnd && oncancelEnd();
        var context = canvas.getContext('2d'),
        render_series = [];
        self.trigger('before-render')
        context.clearRect(0, 0, canvas.width, canvas.height);
        $.each(pages, function(i, page)
          {
            var rect = page.rect;
            if(page.docPage)
              render_series.push(function(cb2)
                {
                  var cb = function(err)
                  {
                    operation_complete(cb2, err);
                  },
                  docPage = page.docPage;
                  if(canceled)
                    return oncancelEnd && oncancelEnd();
                  renderTask = docPage.render({canvasContext: context, 
                                               viewport: page.viewport})
                    .then(function()
                      {
                        cb();
                      })
                    .catch(cb);
                });
            });
        
        async.series(render_series, function(err)
          {
            o.cancelRender = null;
            next(err);
          });
      }
    ], cb);
  }
  function dhtml_global_object(o)
  {
    return $.extend({
      pdfviewer: o._pdfviewer_ctx
    }, dhtml_global);
  }
  var string = 'string',
  funcStr = 'function',
  visible_str = 'visible',
  hidden_str = 'hidden',
  pvobj_key = 'pdfviewer-opts',
  viewer = function(opts)
  {
    if(typeof opts == string)
    {
      if(!methods[opts])
        throw new Error("Undefined function: " + opts);
      var args = arraySlice.call(arguments, 1);
      if(singular_methods.indexOf(opts) == -1)
        return this.each(function()
          {
            methods[opts].apply($(this), args);
          });
      else
        return this.length === 0 ? null : methods[opts].apply(this.eq(0), args);
    }
    return this.each(function()
      {
        var $this = $(this),
        popts = $this.data(pvobj_key);
        if(popts && popts._initialized)
          throw new Error("PDF Viewer is already initialized!");
        $this.data(pvobj_key, $.extend({ _initialized: true }, default_opts));
        if(opts)
          methods.setOptions.call($this, opts);
        var o = $this.data(pvobj_key),
        tmp;
        o._pdfviewer_ctx = {
          next: 'Next',
          previous: 'Previous', 
          option: function(p)
          {
            var o = $this.data(pvobj_key);
            return o[p];
          }
        };
        $this.bind('before-render', function()
          {
            selector_update_active_pages.call($this);
          });
        methods.init_page_selector.call($this);
        methods.update_page_selector.call($this);
        methods.init_resize.call($this);
        if(!o.canvas)
          set_methods.canvas.call($this, $('canvas.pdfviewer-canvas')[0]);
      });
  },
  set_method_call_update = function(self, o, method)
  {
    if(o._collect_updates)
      o._collect_updates.push(([ self, self.pdfviewer ])
                                .concat(arraySlice.call(arguments, 2)));
    else
      self.pdfviewer.apply(self, arraySlice.call(arguments, 2));
  }
  set_methods = {
    display_mode: function(mode)
    {
      var self = this,
      o = self.data(pvobj_key);
      o.display_mode = mode;
      if(o.canvas && o.pdfDoc)
        set_method_call_update(self, o, 'update_canvas_object', o.pdfDoc, o.canvas);
    },
    pdfDoc: function(doc)
    {
      var self = this,
      o = self.data(pvobj_key);
      o.pdfDoc = doc;
      set_method_call_update(self, o, 'update_page_selector');
      if(o.canvas)
      {
        set_method_call_update(self, o, 'set_canvas_size', null);
        set_method_call_update(self, o, 'update_canvas_object', doc, o.canvas);
      }
    },
    canvas: function(canvas)
    {
      var self = this,
      o = self.data(pvobj_key);
      if(o.canvas_binds_releaser)
        funcListCall(o.canvas_binds_releaser);
      var releaser = o.canvas_binds_releaser = [],
      $canvas = $(canvas),
      page_sel = self.find('.page-selector');
      on($canvas, releaser, 'mousemove', function(ev)
         {
           var win_height = $(window).height();
           if(o.show_selector_fac * o._page_sel_height > win_height - ev.clientY)
           {
             if(!page_sel.data(visible_str))
               page_sel.fadeIn(500).data(visible_str, true)
                 .trigger('visibility-changed');
           }
           else if(page_sel.data(visible_str))
             page_sel.fadeOut(500).data(visible_str, false)
               .trigger('visibility-changed');
         })
      ('mousedown', function()
       {
         
       })
      ('mouseup', function()
       {
         
       })
      ('click', function()
       {
         
       })
      ('dblclick', function(ev)
       {
         var o = self.data(pvobj_key),
         offset = self.offset(),
         viewport = o._curPages ? o._curPages.viewport : null,
         relX = (ev.pageX - viewport.offsetX - offset.left) / viewport.width,
         relY = (ev.pageY - viewport.offsetY - offset.top) / viewport.height;
         if(o.zoom > 1)
           o.zoom = 1;
         else
           o.zoom = 2;
         self.trigger('sizechanged', [ function()
           {
             self.bind('before-render', function()
               {
                 var viewport = o._curPages ? o._curPages.viewport : null;
                 if(o.zoom > 1 && viewport)
                 {
                   self.prop('scrollLeft', viewport.offsetX +
                             viewport.width * relX - $(window).width()/2);
                   self.prop('scrollTop', viewport.offsetY +
                             viewport.height * relY - $(window).height()/2);
                 }
                 self.unbind('before-render', arguments.callee);
               });
           } ]);
         return false;
       });
      o.canvas = canvas;
      if(o.pdfDoc)
      {
        set_method_call_update(self, o, 'set_canvas_size', null);
        set_method_call_update(self, o, 'update_canvas_object', o.pdfDoc, canvas);
      }
    }
  },
  get_methods = {

  },
  singular_methods = viewer.singular_methods = [ 'get' ],
  methods = viewer.method = {
    init_resize: function()
    {
      var self = this,
      o = self.data(pvobj_key),
      w = self.width(),
      h = self.height(),
      redraw_timeout = 2000,
      redraw_tm,
      zoom = o.zoom,
      dhtml_ctx = [ dhtml_global_object(o) ];
      on($(window), null, 'resize', resize_handle);
      on(self, null, 'sizechanged', resize_handle);
      self.dhtml('eval', self.data('resize'), dhtml_ctx);
      //resize_handle();
      function resize_handle(ev, cb)
      {
        self.dhtml('eval', self.data('resize'), dhtml_ctx);
        var nw = self.width(),
        nh = self.height(),
        o = self.data(pvobj_key);
        // hack for removing scrollbars
        self.css('overflow', o.zoom > 1 ? '' : 'hidden');
        if(w != nw || h != nh || zoom != o.zoom)
        {
          if(redraw_tm !== undefined)
            clearTimeout(redraw_tm);
          var tmpz = zoom;
          redraw_tm = setTimeout(function()
            {
              if(o.pdfDoc && o.canvas)
              {
                var viewport = o._curPages ? o._curPages.viewport : null;
                self.pdfviewer('set_canvas_size', viewport ? {
                  width: viewport.width / tmpz,
                  height: viewport.height / tmpz
                } : null);
                typeof cb == 'function' ? cb() : null;
                self.pdfviewer('update_canvas_object', o.pdfDoc, o.canvas);
              }
              redraw_tm = undefined;
            }, redraw_timeout);
        }
        w = nw;
        h = nh;
        zoom = o.zoom;
      }
    },
    set_canvas_size: function(size)
    {
      var self = this,
      o = self.data(pvobj_key),
      canvas = o.canvas;
      if(size)
      {
        canvas.width = Math.max(size.width * o.zoom, self.width());
        canvas.height = Math.max(size.height * o.zoom , self.height());
      }
      else
      {
        canvas.width = self.width() * o.zoom;
        canvas.height = self.height() * o.zoom;
      }
    },
    init_page_selector: function()
    {
      var self = this,
      o = self.data(pvobj_key),
      $el = self.find('.page-selector'),
      releaser = o._page_selector_releaser,
      pages_prev = $el.find('.pages-preview');
      pages_prev.dhtml('list_init');
      o._page_sel_height = $el.height();
      $el.hide();
      $el.find('.controls').find('*').dhtml('item_update', dhtml_global_object(o));
      if(releaser)
        funcListCall(releaser);
      releaser = [];
      function checkIfDocExists(cb)
      {
        return function() 
        {
          var o = self.data(pvobj_key),
          pdfDoc = o.pdfDoc;
          if(!pdfDoc || !o._curPages)
            return false;
          return cb.call(this, o, pdfDoc);
        }
      }
      on($el, releaser, 'click', '.next-btn', checkIfDocExists(function(o, pdfDoc)
        {
          if(o.curPageIndex + o._curPages.length <= pdfDoc.numPages)
          {
            o.curPageIndex += o._curPages.length;
            if(o.canvas)
              self.pdfviewer('update_canvas_object', pdfDoc, o.canvas);
          }
          return false;
        }))
      ('click', '.previous-btn', checkIfDocExists(function(o, pdfDoc)
        {
          if(o.curPageIndex - o._curPages.length > 0)
          {
            o.curPageIndex -= o._curPages.length;
            if(o.canvas)
              self.pdfviewer('update_canvas_object', pdfDoc, o.canvas);
          }
          return false;
        }))
      ('click', '.page-item', checkIfDocExists(function(o, pdfDoc)
        {
          var $this = $(this),
          page_idx = parseInt($this.data('page-num'));
          if(page_idx > 0 && page_idx <= pdfDoc.numPages)
          {
            o.curPageIndex = page_idx;
            if(o.canvas)
              self.pdfviewer('update_canvas_object', pdfDoc, o.canvas);
          }
          return false;
        }));
      on(pages_prev, releaser, 'scroll', pages_prev_track_visibility);
      on($el, releaser, 'visibility-changed', pages_prev_track_visibility);
      pages_prev_track_visibility()
      function pages_prev_track_visibility()
      {
        pages_prev.each(function()
          {
            var $this = $(this),
            width = $this.width(),
            scrollX = $this.prop('scrollLeft'),
            offsetX = $this.offset().left,
            list_visible = $this.css('display') != 'none' && 
              $this.css('visible') != 'hidden';
            
            $this.find(' > li').each(function()
              {
                var $el = $(this),
                offx = $el.offset().left - offsetX,
                w = $el.width(),
                was_visible = $el.data('isvisible'),
                p0 = offx - scrollX,
                p1 = offx + w - scrollX,
                visible = list_visible && w && 
                  ((p0 > 0 && p0 < width) || (p1 > 0 && p1 < width));
                if(visible != was_visible)
                {
                  $el.data('isvisible', visible);
                  $el.trigger('visibility-changed');
                }
              });
          });
      }
    },
    update_page_selector: function()
    {
      function update_page(i)
      {
        var item = {
          draw_page_when_visible: function(type)
          {
            var $canvas = this,
            canvas = $canvas[0],
            draw_cmd_sent;
            li.bind('visibility-changed', function(ev)
              {
                if($(this).data('isvisible') && !draw_cmd_sent)
                  draw_page();
              });
            function draw_page()
            {
              draw_cmd_sent = true;
              pdfDoc.getPage(i).then(function(page)
                {
                  var viewport, context;
                  try {
                    viewport = pdf_viewport_for_canvas(page.view, canvas, type);
                    context = canvas.getContext('2d');
                  }catch(e) {
                    console.error(e);
                  }
                  finally {
                    page.render({canvasContext: context, viewport: viewport});
                  }
                });
            }
          },
          page_number: i
        };
        var li = pp.dhtml('list_new_item', null);
        li.attr('data-page-num', item.page_number+'');
        pp.append(li);
        li.dhtml('list_items_update', [ item, dhtml_global_object(o) ]);
      }
      var self = this,
      $el = self.find('.page-selector'),
      pp = $el.find('.pages-preview'),
      o = self.data(pvobj_key),
      pdfDoc = o.pdfDoc;
      pp.html('');
      if(!pdfDoc || pp.length === 0)
        return;
      for(var i = 1, len = pdfDoc.numPages; i <= len; ++i)
        update_page(i);
      
      var v = $el.css('display') != 'none';
      if(!v)
        $el.show();
      o._page_sel_height = $el.height();
      if(!v)
        $el.hide();
    },
    update_canvas_object: function(doc, canvas, cb)
    {
      var self = this;
      update_canvas_object.call(self, doc, canvas, function(err)
        {
          if(err)
            console.error(err);
          cb && cb.apply(self, arguments);
        });
    },
    get: function(prop)
    {
      if(get_methods[prop])
        return get_methods[prop]
                  .apply(this, arraySlice.call(arguments, 1));
      var o = this.data(pvobj_key);
      return o[prop];
    },
    set: function(prop, val)
    {
      if(set_methods[prop])
        return set_methods[prop]
                  .apply(this, arraySlice.call(arguments, 1));
      var o = this.data(pvobj_key);
      return o[prop] = val;
    },
    setOptions: function(opts)
    {
      var o = this.data(pvobj_key);
      var funcs = o._collect_updates = [];

      for(var i in opts)
        methods.set.call(this, i, opts[i]);

      var unique_names = [],
      tmp = [];
      for(var c = funcs.length - 1; c >= 0; --c)
      {
        var func = funcs[c];
        if(unique_names.indexOf(func[2]) == -1)
          tmp.unshift(func);
        unique_names.push(func[2]);
      }
      funcListCall(tmp);
      o._collect_updates = null;
    }
  };
  $.fn.pdfviewer = viewer;
  $(function(){
    $('.pdfviewer').pdfviewer();
  })
})(jQuery);