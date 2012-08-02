/*!
 * QuickLook Photo Gallery 1.0
 *
 * Copyright 2011, Matt Goatcher
 * Licensed under BSD license.
 * See License.txt
 *
 */

const KEYCODE_ARROW_LEFT = 37;
const KEYCODE_ARROW_RIGHT = 39;
const KEYCODE_C = 67;
const KEYCODE_F = 70;
const KEYCODE_N = 78;
const KEYCODE_P = 80;
const KEYCODE_ESC = 27;
const KEYCODE_SPACE = 32;

const IMG_LOADING = safari.extension.baseURI + 'images/loading.gif';
const IMG_PREV = safari.extension.baseURI + 'images/arrow_left_64x64.png';
const IMG_NEXT = safari.extension.baseURI + 'images/arrow_right_64x64.png';
const IMG_PLAY = safari.extension.baseURI + 'images/play_64x64.png';
const IMG_PAUSE = safari.extension.baseURI + 'images/pause_64x64.png';
const IMG_FULL = safari.extension.baseURI + 'images/fullscreen_64x64.png';
const IMG_EXIT_FULL = safari.extension.baseURI + 'images/exit_fullscreen_64x64.png';
const IMG_CLOSE = safari.extension.baseURI + 'images/close_64x64.png';

var settings = {
    min_image_width                 : null,
    min_image_height                : null,
    display_images_on_this_page     : false,
    display_linked_images           : false,
    display_images_on_linked_pages  : false,
    slideshow_delay                 : null,
    image_loading_timeout           : 0,
    image_regexp                    : null,
    
    init : function(data) {
        if(!data) {
            this.error('Unable to load settings for extension');
        }
        
        // Initialize our settings
        this.min_image_width = data.min_image_width > 0 ? data.min_image_width : 250;
        this.min_image_height = data.min_image_height > 0 ? data.min_image_height : 250;
        this.display_images_on = data.display_images_on;
        this.slideshow_delay = data.slideshow_delay > 0 ? data.slideshow_delay : 5;
        this.image_loading_timeout = data.image_loading_timeout > 0 ? data.image_loading_timeout : 7;
        
        if(data.display_images_on == 'this_page' || data.display_images_on == 'all') {
            this.display_images_on_this_page = true;
        }
        if(data.display_images_on == 'linked_pages' || data.display_images_on == 'all') {
            this.display_linked_images = true;
        }
        
        if(data.display_images_on_linked_pages) {
            this.display_images_on_linked_pages = true;
        }
        
        var regexes = new Array();
        if(data.display_jpeg)
            regexes.push('jpe?g');
        if(data.display_gif)
            regexes.push('png');
        if(data.display_png)
            regexes.push('gif');
        
        if(regexes.length <= 0) {
            alert('No image types were specified for display.  Please check settings');
            return null;
        }
        
        this.image_regexp = new RegExp('(' + regexes.join('|') + ')', 'i');
    }
};


var spider = {
    potential_images    : null,
    matched_images      : null,
    current_image_index : -1,
    pending_image_count : 0,
    
    load_start_time     : 0,
    
    _init : function() {
        this.potential_images = new Array();
        this.matched_images = new Array();
        // DEBUGGING
//        setInterval("spider.status()", 5 * 1000);
    },
    
    gatherImages : function() {
        this._init();
        
        this._gatherInlineImages();
        this._gatherLinkedImages();
        this._gatherHtmlImages();
        this._gatherImgurImages();
		if(document.URL.match(/facebook.com/))
			this._gatherFacebookImages();
		if(document.URL.match(/flickr.com/))
			this._gatherFlickrImages();
		if(document.URL.match(/google.com/))
			this._gatherGoogleImages();
    },
    
    getNextImage : function(callback) {
        var d = new Date;
        var now = d.getTime();
        
        if(!this.load_start_time) {
            this.load_start_time = now;
        }

        // Handle images that never load
        if(now - this.load_start_time > settings.image_loading_timeout * 1000) {
            this.pending_image_count = 0;
        }
        
        if(this.current_image_index + 1 >= this.matched_images.length) {
            // If we're still waiting on images, try again in a bit
            if(this.pending_image_count > 0) {
                setTimeout(function() {
                    spider.getNextImage(callback)
                }, 1000);
                return null;
            }
        }
        
        this.current_image_index++;
        if(this.current_image_index >= this.matched_images.length) {
            this.current_image_index = 0;
        }
        
        if(this.matched_images[this.current_image_index]) {
            this.load_start_time = 0;
            callback(this.matched_images[this.current_image_index]);
        }
        else {
            uiController.hidePreviewPane();
            alert('No matching images could be found');
        }

    },
    
    getPreviousImage : function(callback) {
        this.current_image_index--;
        if(this.current_image_index < 0) {
            this.current_image_index = this.matched_images.length - 1;
        }

        if(this.matched_images[this.current_image_index]) {
            callback(this.matched_images[this.current_image_index]);
        }
        else {
            uiController.hidePreviewPane();
            alert('No matching images could be found');
        }
    },
    
    status : function() {
        if(this.potential_images)
            console.log("Potential Images: " + this.potential_images.length);
        if(this.matched_images)
            console.log("Matched Images: " + this.matched_images.length);
        console.log("Current Image Index: " + this.current_image_index);
        console.log("Pending Image Count: " + this.pending_image_count);
    },
    
    _gatherInlineImages : function() {
        if(settings.display_images_on_this_page) {
            $('img').each(function() {
                var src = $(this).attr('src');
                if(src) {
                    spider.pending_image_count++;
                    spider._assessImage(src, function() {
                        spider.pending_image_count--;
                    });
                }
            });
        }
    },
    
    _gatherLinkedImages : function() {
        if(settings.display_linked_images) {
            // Generic linked images
            $('a').each(function() {
                var src = $(this).attr('href');
                if(src && src.match(settings.image_regexp)) {
                    spider.pending_image_count++;
                    spider._assessImage(src, function() {
                        spider.pending_image_count--;
                    });
                }
            });
        }
    },
    
    _gatherHtmlImages : function() {
        if(settings.display_images_on_linked_pages) {
            $('a').each(function() {
                var url = $(this).attr('href');
                safari.self.tab.dispatchMessage("loadUrl", url);
                spider.pending_image_count++;
            });
        }
    },

	_gatherFacebookImages : function() {
		$('#contentArea a').each(function() {
			var full_url = $(this).attr('ajaxify');
			if(full_url) {
				full_url.match(/src=([^&]+)/);
				var url = RegExp.$1;
				if(url) {
					url = unescape(url);
					if(url && url.match(settings.image_regexp)) {
						spider.pending_image_count++;
						spider._assessImage(url, function() {
							spider.pending_image_count--;
						});
					}
				}
			}
		});
	},
	
	_gatherFlickrImages : function() {
		$('.resultsThumbs .photo_container a').each(function() {
			var href = $(this).attr('href');
			href.match(/\/photos\/(.+)\/([0-9]+)\//);
			var user = RegExp.$1;
			var id = RegExp.$2;
			if(id) {
				var proxy = $('<div></div>').hide();
				spider.pending_image_count++;
				proxy.load(href + ' .photo-div img', function() {
					var url = proxy.find('img').attr('src');
					if(url) {
						spider.pending_image_count++;
						spider._assessImage(url, function() {
							spider.pending_image_count--;
						});
						spider.pending_image_count--;
					}
				});
			}
		});
	},
	
	_gatherGoogleImages : function() {
		$('#search .rg_li a').each(function() {
			var href = $(this).attr('href');
			if(href) {
				var proxy = $('<div></div>').hide();
				spider.pending_image_count++;
				proxy.load(href + ' #il_ic img', function() {
					var url = proxy.find('img').attr('src');
					if(url) {
						spider.pending_image_count++;
						spider._assessImage(url, function() {
							spider.pending_image_count++;
						});
						spider.pending_image_count--;
					}
				});
			}
		});
	},
	
	_gatherImgurImages : function() {
        if(settings.display_linked_images) {
            // Automatically append .jpg to image paths where needed
            $('a').each(function() {
                var src = $(this).attr('href');
                if(src && src.match(/imgur.com/) && !src.match(settings.image_regexp)) {
                    src = src + '.jpg';
                    spider.pending_image_count++;
                    spider._assessImage(src, function() {
                        spider.pending_image_count--;
                    });
                }
            });
        }
    },
    
    _assessImage : function(src, callback) {
        // If its a new image, consider it a potential image
        // and assess whether we should add it to our matched
        // images or not
        if(src && helper.arrayPushIfNew(spider.potential_images, src)) {
            var min_width = settings.min_image_width;
            var min_height = settings.min_image_height;
            
            if(src.match(settings.image_regexp)) {
                $('<img src="' + src + '">')
                    .hide()
                    .appendTo('body')
                    .load(function() {
                        if($(this).width() >= min_width && $(this).height() >= min_height) {
                            spider.matched_images.push($(this).attr('src'));
                            if(callback)
                                callback(src);
                        }
                        else {
                            if(callback)
                                callback(src);
                        }
                    });
            }
            else {
                if(callback)
                    callback(src);
            }
        }
        else {
            if(callback)
                callback(src);
        }
    },
};



var uiController = {
    is_initialized  : false,
    is_visible      : false,
	is_ui_waiting	: false,
    
    background_overlay  : null,
    preview_overlay     : null,
    preview_image       : null,
    controller          : null,

    is_slideshow_running    : false,
    slideshow_interval      : null,
    
    last_mousemove          : 999,
    
    
    togglePreviewPane : function() {
            if(!this.is_initialized) {
                this.initPreviewPane();
                this.showPreviewPane();               
            }
            else {
                if(this.is_visible) {
                    this.hidePreviewPane();
                }
                else {
					spider.current_image_index--;
                    this.showPreviewPane();
                }
            }
        },
    
    initPreviewPane : function() {
            this.is_initialized = true;
            
            this.background_overlay = $('<div></div>')
                .css('display', 'none')
                .css('opacity', '.9')
                .css('background', '#000000')
                .appendTo($('body'));
            
            this.preview_overlay = $('<div></div>')
                .css('display', 'none')
                .appendTo($('body'));
                
            this.preview_image = $('<img src="" />')
                .css('max-width', '100%')
                .css('max-height', '100%')
                .appendTo(this.preview_overlay);

            
            this.controller = $('<div></div>')
                .css('width', '492px')
                .css('height', '96px')
                .css('border', '1px solid #444444')
                .css('border-radius', '4px')
                .css('background', '#222222')
                .css('cursor', 'pointer')
                .css('opacity', '.9')
                .appendTo(this.preview_overlay);
            
            $('<div><img src="' + IMG_PREV + '"></div>')
                .css('float', 'left')
                .css('padding', '16px')
                .appendTo(this.controller)
                .click(function() {
                    uiController.resetAutohideTimer();
                    uiController.stopSlideshow();
                    uiController.displayPreviousImage();
                });
                
            $('<div><img src="' + IMG_NEXT + '"></div>')
                .css('float', 'left')
                .css('padding', '16px')
                .appendTo(this.controller)
                .click(function() {
                    uiController.resetAutohideTimer();
                    uiController.stopSlideshow();
                    uiController.displayNextImage();
                });

            $('<div class="pg_play_pause_btn"><img src="' + IMG_PLAY + '"></div>')
                .css('float', 'left')
                .css('padding', '16px')
                .appendTo(this.controller)
                .click(function() {
                    uiController.resetAutohideTimer();
                    uiController.toggleSlideshow();
                });
            
            /* Note: as of early Safari 5.1, full-screen mode is poorly documented and doesn't seem
             * to work everywhere.  The elements used to request and cancel full screen were
             * attained mostly by trial and error and seem to work consistently */
			if(document.documentElement.webkitRequestFullScreen) {
				$('<div class="pg_fullscreen_btn"><img src="' + IMG_FULL + '"></div>')
	                .css('float', 'left')
	                .css('padding', '16px')
	                .appendTo(this.controller)
	                .click(function() {
	                    uiController.resetAutohideTimer();
	                    if(document.webkitIsFullScreen) {
	                        document.webkitCancelFullScreen();
	                        $(this).find('img').attr('src', IMG_FULL);
	                    }
	                    else {
	                        document.documentElement.webkitRequestFullScreen();
	                        $(this).find('img').attr('src', IMG_EXIT_FULL);
	                    }
	                });
			}
			else {
				this.controller.css('width', '396px');
			}

            $('<div><img src="' + IMG_CLOSE + '"></div>')
                .css('float', 'left')
                .css('padding', '16px')
                .appendTo(this.controller)
                .click(function() {
                    document.webkitCancelFullScreen();
                    uiController.hidePreviewPane();
                });
            
            this.positionElements();
            spider.gatherImages();
            
            // Register keyboard handlers
            $(document).keyup(function(event) {
				if(uiController.is_visible) {
	                if(event.keyCode == KEYCODE_ARROW_LEFT || event.keyCode == KEYCODE_P) {
						uiController.stopSlideshow();
	                    uiController.displayPreviousImage();
	                }
	                else if(event.keyCode == KEYCODE_ARROW_RIGHT || event.keyCode == KEYCODE_N) {
						uiController.stopSlideshow();
	                    uiController.displayNextImage();
	                }
					else if(event.keyCode == KEYCODE_SPACE) {
	                    uiController.toggleSlideshow();
					}
					else if(event.keyCode == KEYCODE_C) {
						document.webkitCancelFullScreen();
	                    uiController.hidePreviewPane();
					}
					else if(event.keyCode == KEYCODE_F) {
						uiController.controller.find('.pg_fullscreen_btn').click();
					}
					else {
//						alert(event.keyCode);
					}
				}
            });
            
            // Register window resize and scrolls
            $(window).resize(function(){
				if(uiController.is_visible) {
					uiController.positionElements();
				}
            });
			$(window).scroll(function() {
				if(uiController.is_visible) {
					uiController.positionElements();
				}
			});
            
            
            // Set up auto-hiding controller
            $(window).mousemove(function() {
				if(uiController.is_visible) {
                	uiController.resetAutohideTimer();
				}
            });
            setInterval('uiController.autohideController()', 1000);
            this.resetAutohideTimer();
        },
    
    autohideController : function() {
        var d = new Date();
        if(d.getTime() - this.last_mousemove > 3 * 1000) {
            this.controller.fadeOut();
        }
    },
    
    resetAutohideTimer : function() {
        var d = new Date();
        uiController.last_mousemove = d.getTime();
        uiController.controller.show();
    },
    
    positionElements : function() {
            this.background_overlay
                .css('width', $(document).width())
                .css('height', $(document).height())
                .css('position', 'absolute')
                .css('z-index', '99998')
                .css('top', '0px')
                .css('left', '0px');
            this.preview_overlay
                .css('width', '100%')
                .css('height', '100%')
                .css('position', 'absolute')
                .css('top', '0px')
                .css('left', '0px')
                .css('z-index', '99999');


			var controller_top = $(window).scrollTop() +
				$(window).height() -
				this.controller.height() - 30;
            this.controller
                .css('position', 'absolute')
				.css('top', controller_top)
                .css('left', helper.calcHorizontalCenter(this.controller))

            this.positionImage();
        },
        
    positionImage : function(w, h) {
            var vcenter = helper.calcVerticalCenter(this.preview_image, h);
            var hcenter = helper.calcHorizontalCenter(this.preview_image, w);
        
            this.preview_image
                .css('position', 'absolute')
                .css('top', vcenter + 'px')
                .css('left', hcenter + 'px');
    },
    
    showPreviewPane : function() {
            this.is_visible = true;
            
            this.background_overlay.show();
            this.preview_overlay.show();
            
            this.displayNextImage();
        },
    
    hidePreviewPane : function() {
            this.is_visible = false;
            
            this.background_overlay.hide();
            this.preview_overlay.hide();
        },
        
    displayNextImage : function() {
			if(!uiController.is_ui_waiting) {
				uiController.is_ui_waiting = true;
				
				var preview_image = this.preview_image;
	            preview_image.attr('src', IMG_LOADING);
	            uiController.positionImage();

	            spider.getNextImage(function(src) {
	                $('<img src="'+src+'">')
	                    .appendTo('body')
	                    .hide()
	                    .load(function() {
	                        preview_image.attr('src', src).load(function(){
                                uiController.positionImage();
    							uiController.is_ui_waiting = false;							
    							if(uiController.is_slideshow_running) {
    								uiController.slideshow_interval =  setTimeout("uiController.displayNextImage()", settings.slideshow_delay * 1000);
    							}
                            });
	                    });
	            });
			}
        },
    
    displayPreviousImage: function() {
			if(!uiController.is_ui_waiting) {
				uiController.is_ui_waiting = true;
				
				var preview_image = this.preview_image;
	            preview_image.attr('src', IMG_LOADING);
	            uiController.positionImage();

	            spider.getPreviousImage(function(src) {
	                $('<img src="'+src+'">')
	                    .appendTo('body')
	                    .hide()
	                    .load(function(ev) {
                            preview_image.attr('src', src).load(function(){
                                uiController.positionImage();
                                uiController.is_ui_waiting = false;                         
                                if(uiController.is_slideshow_running) {
                                    uiController.slideshow_interval =  setTimeout("uiController.displayNextImage()", settings.slideshow_delay * 1000);
                                }
                            });
	                    });
	            });
			}
    },
    
    startSlideshow : function() {
        if(!this.is_slideshow_running) {
            this.is_slideshow_running = true;
			uiController.controller.find('.pg_play_pause_btn img').attr('src', IMG_PAUSE);
            this.slideshow_interval = setTimeout("uiController.displayNextImage()", settings.slideshow_delay * 1000);
        }
    },
    
    stopSlideshow : function() {
        if(this.is_slideshow_running) {
            this.is_slideshow_running = false;
			uiController.controller.find('.pg_play_pause_btn img').attr('src', IMG_PLAY);
			clearTimeout(this.slideshow_interval);
            slideshow_interval = null;
        }
    },
    
    toggleSlideshow : function() {    
        if(this.is_slideshow_running) {
            this.stopSlideshow();

        }
        else {
            this.startSlideshow();
        }
    },
    
    error : function (message) {
            if(message) {
                alert(message);
            }
            throw new Exception(message);
    },
};

var helper = {
	arrayPushIfNew : function(array, element) {
		for(var i = 0; i < array.length; i++) {
	        if(array[i] == element) {
	            return null;
	        }
	    }

	    array.push(element);
	    return element;
	},
	
	arrayRemove : function(array, element) {
	    for(var i = 0; i < array.length; i++) {
	        if(array[i] == element) {
	            array.splice(i,i);
	        }
	    }		
	},
	
	calcVerticalCenter : function(element) {
		return ((($(window).height() - element.height()) / 2) + $(window).scrollTop());
	},
	
	calcHorizontalCenter : function(element) {
		return ((($(window).width() - element.width()) / 2) + $(window).scrollLeft());
	}
};


// Receive messages from our global.html
function respondToMessage(event) {
    if(event.name === 'togglePreview') {
        // Don't load multiple times for iframes
        if(window.top === window) {
            settings.init(event.message);
            uiController.togglePreviewPane();
        }
    }
    else if(event.name === 'completedLoadingUrl') {
        spider.pending_image_count--;
    }
    else if(event.name === 'assessImage') {
        var src = event.message;
        if(src && src.match(settings.image_regexp)) {
            spider.pending_image_count++;
            spider._assessImage(src, function() {
                spider.pending_image_count--;
            });
        }
    }
}
safari.self.addEventListener("message", respondToMessage, false);