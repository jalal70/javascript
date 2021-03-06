(function(window, undefined){
var arraySlice = Array.prototype.slice;
function flip_page_restricted_subrout(size, x, y, corner, limits)
{
  if(x <= 0)
    x = 0.01;
  var pivot_angle = Math.atan2(y, x)
  pivot_middle_angle = pivot_angle - Math.PI/2
  pivot_middle_x = x/2,
  pivot_middle_y = y/2,
  tan_pm_angle = Math.tan(pivot_middle_angle),
  x0 = pivot_middle_x - pivot_middle_y / tan_pm_angle,
  y0 = pivot_middle_y - pivot_middle_x * tan_pm_angle;
  var corners = {
    tl: [ 'tr', 'br', 'bl' ],
    tr: [ 'tl', 'bl', 'br' ],
    bl: [ 'br', 'tr', 'tl' ],
    br: [ 'bl', 'tl', 'tr' ]
  },
  corn = corners[corner];
  if(!corn)
    return false;
  if(limits.indexOf(corn[0]) !== -1 && x0 > size[0])
    return true;
  var y1 = pivot_middle_y - (pivot_middle_x - size[0]) * tan_pm_angle;
  if(limits.indexOf(corn[1]) !== -1)
  {
    if(tan_pm_angle < 0)
      return y1 > size[1];
    else
      return y1 < size[1];
  }
  if(limits.indexOf(corn[2]) !== -1 && y0 > size[1])
    return true;
  return false;
}
function flip_page_compute(size, x, y, flipX, flipY, limits)
{
  /*
            |
       p____|y0
       |   /|
       |  / |
       | /  |
    ___|/___|
       x0    O
   */
  if(x <= 0)
    x = 0.01;
  var pivot_angle = Math.atan2(y, x)
  pivot_middle_angle = pivot_angle - Math.PI/2
  pivot_middle_x = x/2,
  pivot_middle_y = y/2,
  tan_pm_angle = Math.tan(pivot_middle_angle),
  x0 = pivot_middle_x - pivot_middle_y / tan_pm_angle,
  y0 = pivot_middle_y - pivot_middle_x * tan_pm_angle;
  if(!isFinite(y0))
    y0 = size[1] * 5;
  var x0_rotation = Math.atan2(y, x - x0),
  p_rotation = Math.PI/2 - x0_rotation,
  offset = 10,
  middle_line_distance = distance([x0, y0]),
  msize = distance(size) * 3 + offset * 2,
  mask_rot = pivot_middle_angle + Math.PI/2;
  return {
    apply_raster_mat: function(ctx)
    {
      ctx.translate(x, y);
      ctx.rotate(-p_rotation + Math.PI/2);
      ctx.translate(flipX ? 0 : -size[0], flipY ? size[1] : 0);
      ctx.scale((flipX ? -1 : 1), (flipY ? -1 : 1))
    },
    apply_mask_mat: function(ctx)
    {
      ctx.translate(x0, 0);
      ctx.rotate(mask_rot);
      ctx.translate(0, -x0 - offset);
      ctx.scale(msize, msize);
      return msize;
    }
  };
}
function image_object_get_rect(obj, name)
{
  var image = obj.image,
  rect = obj[name],
  default_vals = [ 0, 0, image.width, image.height ],
  r;
  if(!rect)
    r = default_vals;
  else if(rect.length < 4)
    r = rect.concat(default_vals.slice(rect.length));
  else
    r = rect;
  return r;
}
function is_image_object(obj)
{
  return typeof obj == 'object';
}
function render_subrout_draw_behind_page(ctx, drect, mats, src, flip)
{
  ctx.save();

  ctx.save();
  var msize = mats.apply_mask_mat(ctx);
  ctx.translate(2/msize, 0);
  ctx.scale(-1, 1);
  ctx.beginPath();
  ctx.rect(0, 0, 1, 1);
  ctx.restore();
  ctx.clip();

  ctx.scale(flip.x ? -1 : 1, flip.y ? -1 : 1);
  ctx.translate((flip.x ? -1 : 0) * drect[2], (flip.y ? -1 : 0) * drect[3]);
  if(is_image_object(src))
  {
    var srect = image_object_get_rect(src, 'src_rect');
    ctx.drawImage.apply(ctx, ([ src.image ])
                               .concat(srect, [0,0].concat(drect.slice(2, 4))));
  }
  else
  {
    ctx.fillStyle = typeof src == 'string' ? src : '#ffffff';
    ctx.fillRect.apply(ctx, [0,0].concat(drect.slice(2, 4)));
  }
  ctx.restore();
}
function render_subrout_draw_page(ctx, drect, src)
{
  ctx.save();
  if(is_image_object(src))
  {
    var srect = image_object_get_rect(src, 'src_rect');
    ctx.drawImage.apply(ctx, ([ src.image ])
                               .concat(srect, [0,0].concat(drect.slice(2, 4))));
  }
  else
  {
    ctx.fillStyle = typeof src == 'string' ? src : '#ffffff';
    ctx.fillRect.apply(ctx, [0,0].concat(drect.slice(2, 4)));
  }
  ctx.restore();
}
function render_subrout_draw_flipped_page(ctx, drect, mats, src, pivot)
{ 
  ctx.save();

  // clip rect
  if(mats)
  {
    ctx.save();
    mats.apply_mask_mat(ctx);
    ctx.beginPath()
    ctx.rect(0, 0, 1, 1);
    ctx.restore();
    ctx.clip();
    
    mats.apply_raster_mat(ctx);
    ctx.shadowBlur = 1 * (2 - (pivot[0] / drect[2]));
    ctx.shadowColor = '#444444';
  }
  if(is_image_object(src))
  {
    var srect = image_object_get_rect(src, 'src_rect');
    ctx.drawImage.apply(ctx, ([ src.image ])
                        .concat(srect, [0,0].concat(drect.slice(2,4))));
  }
  else
  {
    ctx.fillStyle = typeof src == 'string' ? src : '#ffffff';
    ctx.fillRect.apply(ctx, [0,0].concat(drect.slice(2, 4)));
  }
  
  ctx.restore();
}
function render_page_subrout_apply_flip(ctx, rect, flipX, flipY)
{
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.translate((flipX ? -1 : 0) * rect[2], (flipY ? -1 : 0) * rect[3]);
}
function distance(point)
{
  return Math.sqrt(point[0] * point[0] + point[1] * point[1]);
}
function vector_minus(p0, p1)
{
  return [ p0[0] - p1[0],
           p0[1] - p1[1] ];
}
function vector_scale(point, d)
{
  return [ point[0] * d, point[1] * d ];
}
function corner_to_flip(corner)
{
  var flipX, flipY;
  switch(corner)
  {
  case 'tr':
    flipX = true;
    break;
  case 'bl':
    flipY = true;
    break;
  case 'br':
    flipX = true;
    flipY = true;
    break;
  }
  return { x: flipX, y: flipY };
}
function flip_page_restricted(rect, corner, pivot, limits)
{
  var flip = corner_to_flip(corner)
  if(!pivot || !limits)
    return false;
  pivot = [ flip.x ? rect[2] + rect[0] - pivot[0] : pivot[0] - rect[0],
            flip.y ? rect[3] + rect[1] - pivot[1] : pivot[1] - rect[1] ];
  return flip_page_restricted_subrout(rect.slice(2, 4), pivot[0], pivot[1], 
                                      corner, limits);
}
function render_page(ctx, rect, src0, src1, src2, corner, pivot)
{
  var flip = corner_to_flip(corner),
  mats;
  if(corner && pivot)
  {
    pivot = [ flip.x ? rect[2] + rect[0] - pivot[0] : pivot[0] - rect[0],
              flip.y ? rect[3] + rect[1] - pivot[1] : pivot[1] - rect[1] ];
    if(pivot && pivot[0] === 0 && pivot[1] === 0)
      pivot = null;
    if(pivot)
      mats = flip_page_compute(rect.slice(2, 4), pivot[0], pivot[1],
                               flip.x, flip.y);
  }

  ctx.save();

  ctx.translate.apply(ctx, rect.slice(0, 2));
  // draw src2 with extended version of flip mask
  render_subrout_draw_page(ctx, rect, src2);

  if(mats)
  {
    render_page_subrout_apply_flip(ctx, rect, flip.x, flip.y);
    // draw src0 as full page if corner exists
    render_subrout_draw_behind_page(ctx, rect, mats, src0, flip);
    // draw src3 with flip_mat and flip mask
    render_subrout_draw_flipped_page(ctx, rect, mats, src1, pivot);
  }
  ctx.restore();
}

var PageCurl = function(opts)
{
  var self = this;
  $.extend(self, opts)
  self.bind_grab();
},
p = PageCurl.prototype;
p.destroy = function()
{
  var releaser = this._releaser;
  if(releaser)
    funcListCall(releaser);
}
p.render = function()
{
  var self = this,
  canvas = self.canvas,
  ctx = canvas.getContext('2d');
  $(self).trigger('before-render');
  if(self.clear_canvas)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  PageCurl.render_page(ctx, self.rect, self.src0, self.src1, self.src2, 
                       self.corner, self.pivot);
  $(self).trigger('rendered');
}
p.curlpage = function()
{
  if(this._curlpage)
    this._curlpage.apply(this, arguments);
}
p.bind_grab = function()
{
  var self = this,
  canvas = self.canvas,
  $canvas = $(canvas),
  corner_epsilon_x = self.corner_epsilon_x,
  corner_epsilon_y = self.corner_epsilon_y,
  rect = self.rect,
  corners = self.corners,
  cur_tween_data = {},
  cur_tween,
  prev_corner,
  prev_pivot,
  prev_time,
  speed,
  pagecurl_started,
  releaser = this._releaser = [];
  function pagecurl_start()
  {
    if(!pagecurl_started)
    {
      pagecurl_started = true;
      $(self).trigger('pagecurl-start');
    }
  }
  function pagecurl_end()
  {
    if(pagecurl_started)
    {
      pagecurl_started = false;
      $(self).trigger('pagecurl-end');
    }
  }
  function tween_finished()
  {
    cur_tween_data.active = false;
  }
  function render(corner, pivot)
  {
    self.corner = corner;
    self.pivot = pivot;
    self.render();
  }
  function render_tween()
  { 
    var pivot = cur_tween_data.active ? 
      [ cur_tween_data.pivotX, cur_tween_data.pivotY ] : null,
    corner = cur_tween_data.active ? cur_tween_data.corner : null;
    if(pivot)
      update(corner, pivot); 
  }
  function update(corner, pivot)
  {
    function update_change(corner, pivot)
    {
      render(corner, pivot);
      if(prev_pivot)
        speed = distance(vector_minus(pivot, prev_pivot)) / (time - prev_time);
      prev_time = time;
      prev_corner = corner;
      prev_pivot = pivot;
    }
    var time = new Date().getTime();
    if(!self.limits || !flip_page_restricted(rect, corner, pivot, self.limits))
    {
      update_change(corner, pivot);
    }
    else if(prev_pivot)
      closestLine();
    function closestLine()
    {
      function point_in_line(nlen)
      {
        return [ pivot[0] + nlen * vec[0] / len, 
                 pivot[1] + nlen * vec[1] / len ];
      }
      var vec = [ prev_pivot[0] - pivot[0], 
                  prev_pivot[1] - pivot[1] ],
      len = distance(prev_pivot, pivot),
      min = 0,
      max = len,
      mp = (max - min) / 2 + min,
      p2 = point_in_line(mp),
      fine_point;
      
      while(max - min > 1)
      {
        if(flip_page_restricted(rect, corner, p2, self.limits))
        {
          min = mp;
        }
        else
        {
          fine_point = p2;
          max = mp;
        }
        mp = (max - min) / 2 + min;
        p2 = point_in_line(mp);
      }
      if(fine_point)
      {
        pivot = fine_point;
        update_change(corner, pivot);
      }
    }
  }
  function corner_mouse_info(corner, mx, my)
  {
    var v,
    flip = corner_to_flip(corner),
    corner_off = [ (flip.x ? rect[2] : 0) + rect[0],
                   (flip.y ? rect[3] : 0) + rect[1] ],
    epsX = corner_epsilon_x * (flip.x ? -1 : 1),
    epsY = corner_epsilon_y * (flip.y ? -1 : 1),
    offX = Math.min(corner_off[0], corner_off[0] + epsX),
    offY = Math.min(corner_off[1], corner_off[1] + epsY);
    return {
      inspace: mx !== undefined && my !== undefined ? 
        ((v = mx - offX) > 0 && v < Math.abs(epsX) &&
         (v = my - offY) > 0 && v < Math.abs(epsY)) : undefined,
      offset: corner_off,
      epsX: epsX,
      epsY: epsY,
      flip: flip
    };
  }
  function show_corner_if_relevant(corner, mx, my)
  {
    var info = corner_mouse_info(corner, mx, my);
    if(info.inspace)
    {
      if(cur_tween_data.state != corner)
      {
        cur_tween_data.active = true;
        cur_tween_data.state = corner;
        cur_tween_data.corner = corner;
        cur_tween_data.pivotX = info.offset[0];
        cur_tween_data.pivotY = info.offset[1];
        cur_tween = new TWEEN.Tween(cur_tween_data)
          .to({
            pivotX: info.epsX + cur_tween_data.pivotX,
            pivotY: [ info.epsY*0.7 + cur_tween_data.pivotY,
                      info.epsY + cur_tween_data.pivotY ]
          }, 500)
          .easing(TWEEN.Easing.Cubic.InOut)
          .onUpdate(render_tween)
          .onComplete(tween_finished)
          .start();
        animate();
        pagecurl_start();
      }
      return true;
    }
    return false;
  }
  function remove_corner()
  {
    var info = corner_mouse_info(cur_tween_data.corner);
    cur_tween_data.active = true;
    cur_tween_data.state = '';
    cur_tween = new TWEEN.Tween(cur_tween_data)
      .to({
        pivotX: info.offset[0],
        pivotY: info.offset[1]
      }, 500)
      .easing(TWEEN.Easing.Cubic.In)
      .onUpdate(render_tween)
      .onComplete(function(){
        cur_tween_data.corner = '';
        tween_finished();
        pagecurl_end();
      })
      .start();
    animate();
  }
  function update_mouse_position(ev)
  {
    var canvas_off = $canvas.offset(),
    mx = ev.pageX - canvas_off.left,
    my = ev.pageY - canvas_off.top,
    res;
    if(!cur_tween_data.active)
    {
      if(!self.grabbable)
        return;
      for(var i = 0, l = corners.length; i < l; ++i)
      {
        res = show_corner_if_relevant(corners[i], mx, my);
        if(res === true)
          break;
      }
      if(!res && cur_tween_data.corner)
      {
        remove_corner();
        return false;
      }
      else if(res)
        return false;
    }
    else if(cur_tween_data.state == 'grabbed')
    {
      update(cur_tween_data.corner, [ mx, my ]);
      return false;
    }
  }
  function animate()
  {
    if(cur_tween_data.active)
    {
      requestAnimationFrame(animate);
      TWEEN.update();
    }
  }
  on($(window), releaser, 'mouseup', function(ev)
    {
      if(cur_tween_data.state == 'grabbed')
      {
        var pivot, curl_page,
        info = corner_mouse_info(cur_tween_data.corner),
        speedy_curl;
        if(prev_pivot)
        {
          var rem = (info.flip.x ? prev_pivot[0] - rect[0] : 
                     rect[2] - prev_pivot[0] + rect[0]) + rect[2];
          speedy_curl = speed * 500 > rem;
          if(speedy_curl || 
             (info.flip.x ? prev_pivot[0] < info.offset[0] - rect[2] :
              prev_pivot[0] > info.offset[0] + rect[2]))
          {
            pivot = [ info.offset[0] + 2 * rect[2] * (info.flip.x ? -1 : 1),
                      info.offset[1] ];
            curl_page = true;
          }
      }
      if(!curl_page)
        pivot = [ info.offset[0], info.offset[1] ];
        if(prev_pivot)
        {
          cur_tween_data.pivotX = prev_pivot[0];
          cur_tween_data.pivotY = prev_pivot[1];
        }
        cur_tween_data.active = true;
        cur_tween_data.state = '';
        cur_tween = new TWEEN.Tween(cur_tween_data)
          .to({
            pivotX: pivot[0],
            pivotY: pivot[1]
          }, 500)
          .easing(!speedy_curl ? 
                     TWEEN.Easing.Cubic.In : TWEEN.Easing.Linear.None)
          .onUpdate(render_tween)
          .onComplete(function(){
            $(self).trigger('grabend');
            cur_tween_data.corner = '';
            tween_finished();
            pagecurl_end();
            if(curl_page)
              $(self).trigger('page-curled');
          })
          .start();
        animate();
        speed = 0;
        return false;
      }
    });
  on($canvas, releaser, 'mousemove', update_mouse_position)
  ('mouseout', function(ev)
    {
      if(!cur_tween_data.active && cur_tween_data.corner)
      {
        remove_corner();
      }
    })
  ('mousedown', function(ev)
    {
      if(!self.grabbable)
        return;
      var canvas_off = $canvas.offset(),
      mx = ev.pageX - canvas_off.left,
      my = ev.pageY - canvas_off.top,
      v, grabbed;
      prev_pivot = null;
      for(var i = 0, l = corners.length; i < l; ++i)
      {
        var corner = corners[i],
        info = corner_mouse_info(corner, mx, my);
        if(info.inspace)
        {
          if(cur_tween_data.active && cur_tween)
            cur_tween.stop();
          cur_tween_data.active = true;
          cur_tween_data.state = 'grabbed';
          cur_tween_data.corner = corner;
          update_mouse_position(ev);
          $(self).trigger('grab');
          grabbed = true;
          pagecurl_start();
          break;
        }
      }
      return !grabbed;
    });
  self._curlpage = function(corner, cb)
  {
    var info = corner_mouse_info(corner),
    pivot = [ info.offset[0] + 2 * rect[2] * (info.flip.x ? -1 : 1),
              info.offset[1] ],
    flip = info.flip;
    cur_tween_data.active = true;
    cur_tween_data.state = '';
    cur_tween_data.corner = corner;
    var sx  = cur_tween_data.pivotX = info.offset[0],
    sy = cur_tween_data.pivotY = info.offset[1];
    cur_tween = new TWEEN.Tween(cur_tween_data)
      .to({
        pivotX: pivot[0],
        pivotY: [ pivot[1] + rect[3] * 0.2 * (flip.y ? -1 : 1),
                  pivot[1] ]
      }, 800)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(render_tween)
      .onComplete(function(){
        cur_tween_data.corner = '';
        pagecurl_end();
        tween_finished();
        $(self).trigger('page-curled');
        cb && cb();
      })
      .start();
    animate();
    pagecurl_start();
  }
}

PageCurl.render_page = render_page;
PageCurl.flip_page_restricted = flip_page_restricted;

window.PageCurl = PageCurl;
})(window);
