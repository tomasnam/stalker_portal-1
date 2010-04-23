/**
 * Player constructor
 * @constructor
 */
function player(){
    
    var self = this;
    
    this.on = false;
    
    this.f_ch_idx = 0;
    this.ch_idx   = 0;
    this.channels;
    this.fav_channels;
    this.fav_channels_ids;
    
    this.start_time;
    this.cur_media_item;
    this.need_show_info = 0;
    
    this.pause = {"on" : false};
    
    this.is_tv = false;
    
    this.prev_layer = {};
    
    this.info = {"on" : false, "hide_timer" : 2000};
    
    this.init();
    this.init_pause();
    this.init_show_info();
}

player.prototype.init = function(){
    _debug('player.init');
    try{
        stb.InitPlayer();
        stb.SetTopWin(0);
        stb.SetAspect(0x10);
        stb.SetPIG(1, -1, -1, -1);
        stb.SetUserFlickerControl(1);
        stb.SetDefaultFlicker(1);
        stb.SetLoop(0);
        stb.SetMicVolume(100);
        
        stbEvent.onEvent = (function(self){
            return function(){
                self.event_callback.apply(self, arguments);
            }
        })(this);
    }catch(e){
        _debug(e);
    }
}

player.prototype.event_callback = function(event){
    _debug('event: ', event);
    
    var event = parseInt(event);
    
    switch(event){
        case 1: // End of stream
        {
            try{
                this.prev_layer && this.prev_layer.show && this.prev_layer.show.call(this.prev_layer, true);
                this.stop();
            }catch(e){
                _debug(e);
            }
            
            break;
        }
        case 4: // Playback started
        {
            
            break;
        }
    }
}

player.prototype.volume_bar = new function(){
    this.volume = 100;
    this.volume_bar_dom_obj = $('volume_bar');
    
    this.set_volume = function(v){
        this.volume = v;
        stb.SetVolume(this.volume);
    }
    
    this.show = function(){
        this.volume_bar_dom_obj.show();
    }
    
    this.hide = function(){
        this.volume_bar_dom_obj.hide();
    }
    
    this.save = function(){
        stb.load(

            {
                'type'   : 'stb',
                'action' : 'set_volume',
                'vol'    : this.volume
            },
            
            function(result){

            }

        );
    }
}

player.prototype.seek_bar = new function(){
    
    this.seek_bar_dom_obj = $('seek_bar');
    
    this.show = function(){
        this.seek_bar_dom_obj.show();
    }
    
    this.hide = function(){
        this.seek_bar_dom_obj.hide();
    }
    
    this.set_pos = function(){
        
    }
}

player.prototype.define_media_type = function(cmd){
    
    if (cmd.indexOf('://') > 0){
        
        if (cmd.indexOf('udp://') || cmd.indexOf('rtp://')){
            this.is_tv = true;
        }
        
        return 'stream';
    }else{
        this.is_tv = false;
        return 'file';
    }
}

player.prototype.play_last = function(){
    _debug('player.play_last');
    
    this.play(this.cur_media_item);
}

player.prototype.play = function(item){
    _debug('player.play');
    
    var cmd;
    
    this.on = true;
    
    this.cur_media_item = item;
    
    if (typeof(item) == 'object'){
        if (!item.hasOwnProperty('cmd')){
            return;
        }
        cmd = item.cmd;
    }else{
        cmd = item;
    }
    
    _debug('cmd: ', cmd);
    
    this.media_type = this.define_media_type(cmd);
    
    _debug('player.media_type: ', this.media_type);
    
    if (this.media_type == 'stream'){
        this.play_now(cmd);
        
        if (this.is_tv){
            this.send_last_tv_id(item.id);
        }
        
    }else{
        this.create_link('vod', cmd);
    }
    
}

player.prototype.create_link = function(type, uri){
    
    stb.load(

        {
            'type'   : type,
            'action' : 'create_link',
            'cmd'    : uri,
            'series' : ''
        },
        
        function(result){
            _debug('create_link callback: ', result);
            
            this.play_now(result.cmd);
        },
        
        this
    )
}

player.prototype.play_now = function(uri){
    _debug('player.play_now');
    
    this.start_time = Date.parse(new Date())/1000;

    if (this.need_show_info){
        this.show_info(this.cur_media_item);
    }
    
    try{
        stb.Play(uri);
    }catch(e){_debug(e)}
}

player.prototype.stop = function(){
    _debug('player.stop');
    
    this.prev_layer = {};
    
    this.need_show_info = 0;
    
    this.on = false;
    
    if(this.pause.on){
        this.disable_pause();
    }
    
    try{
        stb.Stop();
    }catch(e){}
}

player.prototype.init_pause = function(){
    this.pause.dom_obj = create_block_element('pause');
    this.pause.dom_obj.hide();
}

player.prototype.pause_switch = function(){
    _debug('player.pause_switch');
    
    if (this.is_tv){
        return;
    }
    
    if (this.pause.on){
        this.disable_pause();
    }else{
        try{
            stb.Pause();
        }catch(e){};
        this.pause.on = true;
        this.pause.dom_obj.show();
    }
}

player.prototype.disable_pause = function(){
    try{
        stb.Continue();
    }catch(e){};
    this.pause.on = false;
    this.pause.dom_obj.hide();
}

player.prototype.show_info_after_play = function(){
    this.need_show_info = 1;
}

player.prototype.init_show_info = function(){
    
    this.info.dom_obj = create_block_element("osd_info");
    
    this.info.title = create_block_element("osd_info_title", this.info['dom_obj']);
    
    this.info.epg   = create_block_element("osd_info_epg", this.info['dom_obj']);
    
    this.info.dom_obj.hide();
}

player.prototype.show_info = function(item){
    _debug('show_info');
    
    try{
        if(this.info.on){
            window.clearTimeout(this.info.hide_timeout);
        }else{
            this.info.dom_obj.show();
            this.info.on = true;
        }
        
        var title = '';
        
        if (item.hasOwnProperty('number')){
            title = item.number + '. ';
        }
        
        title += item.name
        
        this.info.title.innerHTML = title;
        
        var self = this;
        
        this.info.hide_timeout = window.setTimeout(function(){
            self.info.dom_obj.hide();
            self.info.on = false
        },
        this.info.hide_timer);
    }catch(e){
        _debug(e);
    }
}

player.prototype.switch_channel = function(dir, show_info){
    
    _debug('switch_channel', dir);
    
    if (!this.is_tv){
        return;
    }
    
    if (dir > 0){
        
        if (stb.user.fav_itv_on){
            
            if (this.f_ch_idx < this.fav_channels.length-1){
                this.f_ch_idx++;
            }else{
                this.f_ch_idx = 0;
            }
            
            _debug('this.f_ch_idx:', this.f_ch_idx);
            
            if (show_info){
                this.show_info(this.fav_channels[this.f_ch_idx]);
            }
            
            this.play(this.fav_channels[this.f_ch_idx]);
            
        }else{
            
            if (this.ch_idx < this.channels.length-1){
                this.ch_idx++;
            }else{
                this.ch_idx = 0;
            }
            
            _debug('this.ch_idx:', this.ch_idx);
            
            if (show_info){
                this.show_info(this.channels[this.ch_idx]);
            }
            
            this.play(this.channels[this.ch_idx]);
        }
        
    }else{
        if (stb.user.fav_itv_on){
            
            if (this.f_ch_idx > 0){
                this.f_ch_idx--;
            }else{
                this.f_ch_idx = this.fav_channels.length-1;
            }
            
            _debug('this.f_ch_idx:', this.f_ch_idx);
            
            if (show_info){
                this.show_info(this.fav_channels[this.f_ch_idx]);
            }
            this.play(this.fav_channels[this.f_ch_idx]);
            
        }else{
            
            if (this.ch_idx > 0){
                this.ch_idx--;
            }else{
                this.ch_idx = this.channels.length-1;
            }
            
            _debug('this.ch_idx:', this.ch_idx);
            
            if (show_info){
                this.show_info(this.channels[this.ch_idx]);
            }
            this.play(this.channels[this.ch_idx]);
        }
    }
}

player.prototype.send_last_tv_id = function(id){
    _debug('send_last_tv_id', id);
    
    stb.load(

        {
            'type'   : 'itv',
            'action' : 'set_last_id',
            'id'     : id
        },
        
        function(result){
            _debug('last_tv_id saved', result);
        }
    )
}

player.prototype.show_prev_layer = function(){
    _debug('player.show_prev_layer');
    
    this.prev_layer.show.call(this.prev_layer, true);
    
    this.stop();
}

player.prototype.bind = function(){
    
    var self = this;
    
    this.switch_channel.bind(key.UP, self, 1);
    this.switch_channel.bind(key.DOWN, self, -1);
    
    this.switch_channel.bind(key.CHANNEL_NEXT, self, 1, true);
    this.switch_channel.bind(key.CHANNEL_PREV, self, -1, true);
    
    this.pause_switch.bind(key.PAUSE, this);
    
    this.show_prev_layer.bind(key.EXIT, self);
}

player.prototype.save_fav_ids = function(){
    _debug('player.save_fav');
    
    stb.load(

        {
            'type'   : 'itv',
            'action' : 'set_fav',
            'fav_ch' : this.fav_channels_ids
        },
        
        function(result){
            _debug('fav_saved', result);
        },
        
        this
    )
}

player.prototype.get_file_type = function(item){
    
    var cmd = '';
    
    if (typeof(item) == 'object'){
        cmd = item.cmd;
    }else{
        cmd = item;
    }
    
    var p = /^(.*)\.(\S+)$/
    
    var ext = ['mp3', 'ac3', 'mov', 'vob', 'wav'];

    if (ext.indexOf(cmd.replace(p, "$2")) != -1){
        return 'audio';
    }else{
        return 'video';
    }
}
/*
 * END Player
 */