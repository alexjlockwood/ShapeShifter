/**
 * material-design-lite - Material Design Components in CSS, JS and HTML
 * @version v1.2.1
 * @license Apache-2.0
 * @copyright 2015 Google, Inc.
 * @link https://github.com/google/material-design-lite
 */
!function(){"use strict";function e(e,t){if(e){if(t.element_.classList.contains(t.CssClasses_.MDL_JS_RIPPLE_EFFECT)){var s=document.createElement("span");s.classList.add(t.CssClasses_.MDL_RIPPLE_CONTAINER),s.classList.add(t.CssClasses_.MDL_JS_RIPPLE_EFFECT);var i=document.createElement("span");i.classList.add(t.CssClasses_.MDL_RIPPLE),s.appendChild(i),e.appendChild(s)}e.addEventListener("click",function(s){if("#"===e.getAttribute("href").charAt(0)){s.preventDefault();var i=e.href.split("#")[1],n=t.element_.querySelector("#"+i);t.resetTabState_(),t.resetPanelState_(),e.classList.add(t.CssClasses_.ACTIVE_CLASS),n.classList.add(t.CssClasses_.ACTIVE_CLASS)}})}}function t(e,t,s,i){function n(){var n=e.href.split("#")[1],a=i.content_.querySelector("#"+n);i.resetTabState_(t),i.resetPanelState_(s),e.classList.add(i.CssClasses_.IS_ACTIVE),a.classList.add(i.CssClasses_.IS_ACTIVE)}if(i.tabBar_.classList.contains(i.CssClasses_.JS_RIPPLE_EFFECT)){var a=document.createElement("span");a.classList.add(i.CssClasses_.RIPPLE_CONTAINER),a.classList.add(i.CssClasses_.JS_RIPPLE_EFFECT);var l=document.createElement("span");l.classList.add(i.CssClasses_.RIPPLE),a.appendChild(l),e.appendChild(a)}e.addEventListener("click",function(t){"#"===e.getAttribute("href").charAt(0)&&(t.preventDefault(),n())}),e.show=n}var s={upgradeDom:function(e,t){},upgradeElement:function(e,t){},upgradeElements:function(e){},upgradeAllRegistered:function(){},registerUpgradedCallback:function(e,t){},register:function(e){},downgradeElements:function(e){}};s=function(){function e(e,t){for(var s=0;s<c.length;s++)if(c[s].className===e)return"undefined"!=typeof t&&(c[s]=t),c[s];return!1}function t(e){var t=e.getAttribute("data-upgraded");return null===t?[""]:t.split(",")}function s(e,s){var i=t(e);return i.indexOf(s)!==-1}function i(e,t,s){if("CustomEvent"in window&&"function"==typeof window.CustomEvent)return new CustomEvent(e,{bubbles:t,cancelable:s});var i=document.createEvent("Events");return i.initEvent(e,t,s),i}function n(t,s){if("undefined"==typeof t&&"undefined"==typeof s)for(var i=0;i<c.length;i++)n(c[i].className,c[i].cssClass);else{var l=t;if("undefined"==typeof s){var o=e(l);o&&(s=o.cssClass)}for(var r=document.querySelectorAll("."+s),_=0;_<r.length;_++)a(r[_],l)}}function a(n,a){if(!("object"==typeof n&&n instanceof Element))throw new Error("Invalid argument provided to upgrade MDL element.");var l=i("mdl-componentupgrading",!0,!0);if(n.dispatchEvent(l),!l.defaultPrevented){var o=t(n),r=[];if(a)s(n,a)||r.push(e(a));else{var _=n.classList;c.forEach(function(e){_.contains(e.cssClass)&&r.indexOf(e)===-1&&!s(n,e.className)&&r.push(e)})}for(var d,h=0,u=r.length;h<u;h++){if(d=r[h],!d)throw new Error("Unable to find a registered component for the given class.");o.push(d.className),n.setAttribute("data-upgraded",o.join(","));var E=new d.classConstructor(n);E[C]=d,p.push(E);for(var m=0,L=d.callbacks.length;m<L;m++)d.callbacks[m](n);d.widget&&(n[d.className]=E);var I=i("mdl-componentupgraded",!0,!1);n.dispatchEvent(I)}}}function l(e){Array.isArray(e)||(e=e instanceof Element?[e]:Array.prototype.slice.call(e));for(var t,s=0,i=e.length;s<i;s++)t=e[s],t instanceof HTMLElement&&(a(t),t.children.length>0&&l(t.children))}function o(t){var s="undefined"==typeof t.widget&&"undefined"==typeof t.widget,i=!0;s||(i=t.widget||t.widget);var n={classConstructor:t.constructor||t.constructor,className:t.classAsString||t.classAsString,cssClass:t.cssClass||t.cssClass,widget:i,callbacks:[]};if(c.forEach(function(e){if(e.cssClass===n.cssClass)throw new Error("The provided cssClass has already been registered: "+e.cssClass);if(e.className===n.className)throw new Error("The provided className has already been registered")}),t.constructor.prototype.hasOwnProperty(C))throw new Error("MDL component classes must not have "+C+" defined as a property.");var a=e(t.classAsString,n);a||c.push(n)}function r(t,s){var i=e(t);i&&i.callbacks.push(s)}function _(){for(var e=0;e<c.length;e++)n(c[e].className)}function d(e){if(e){var t=p.indexOf(e);p.splice(t,1);var s=e.element_.getAttribute("data-upgraded").split(","),n=s.indexOf(e[C].classAsString);s.splice(n,1),e.element_.setAttribute("data-upgraded",s.join(","));var a=i("mdl-componentdowngraded",!0,!1);e.element_.dispatchEvent(a)}}function h(e){var t=function(e){p.filter(function(t){return t.element_===e}).forEach(d)};if(e instanceof Array||e instanceof NodeList)for(var s=0;s<e.length;s++)t(e[s]);else{if(!(e instanceof Node))throw new Error("Invalid argument provided to downgrade MDL nodes.");t(e)}}var c=[],p=[],C="mdlComponentConfigInternal_";return{upgradeDom:n,upgradeElement:a,upgradeElements:l,upgradeAllRegistered:_,registerUpgradedCallback:r,register:o,downgradeElements:h}}(),s.ComponentConfigPublic,s.ComponentConfig,s.Component,s.upgradeDom=s.upgradeDom,s.upgradeElement=s.upgradeElement,s.upgradeElements=s.upgradeElements,s.upgradeAllRegistered=s.upgradeAllRegistered,s.registerUpgradedCallback=s.registerUpgradedCallback,s.register=s.register,s.downgradeElements=s.downgradeElements,window.componentHandler=s,window.componentHandler=s,window.addEventListener("load",function(){"classList"in document.createElement("div")&&"querySelector"in document&&"addEventListener"in window&&Array.prototype.forEach?(document.documentElement.classList.add("mdl-js"),s.upgradeAllRegistered()):(s.upgradeElement=function(){},s.register=function(){})}),Date.now||(Date.now=function(){return(new Date).getTime()},Date.now=Date.now);for(var i=["webkit","moz"],n=0;n<i.length&&!window.requestAnimationFrame;++n){var a=i[n];window.requestAnimationFrame=window[a+"RequestAnimationFrame"],window.cancelAnimationFrame=window[a+"CancelAnimationFrame"]||window[a+"CancelRequestAnimationFrame"],window.requestAnimationFrame=window.requestAnimationFrame,window.cancelAnimationFrame=window.cancelAnimationFrame}if(/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent)||!window.requestAnimationFrame||!window.cancelAnimationFrame){var l=0;window.requestAnimationFrame=function(e){var t=Date.now(),s=Math.max(l+16,t);return setTimeout(function(){e(l=s)},s-t)},window.cancelAnimationFrame=clearTimeout,window.requestAnimationFrame=window.requestAnimationFrame,window.cancelAnimationFrame=window.cancelAnimationFrame}var o=function(e){this.element_=e,this.init()};window.MaterialButton=o,o.prototype.Constant_={},o.prototype.CssClasses_={RIPPLE_EFFECT:"mdl-js-ripple-effect",RIPPLE_CONTAINER:"mdl-button__ripple-container",RIPPLE:"mdl-ripple"},o.prototype.blurHandler_=function(e){e&&this.element_.blur()},o.prototype.disable=function(){this.element_.disabled=!0},o.prototype.disable=o.prototype.disable,o.prototype.enable=function(){this.element_.disabled=!1},o.prototype.enable=o.prototype.enable,o.prototype.init=function(){if(this.element_){if(this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT)){var e=document.createElement("span");e.classList.add(this.CssClasses_.RIPPLE_CONTAINER),this.rippleElement_=document.createElement("span"),this.rippleElement_.classList.add(this.CssClasses_.RIPPLE),e.appendChild(this.rippleElement_),this.boundRippleBlurHandler=this.blurHandler_.bind(this),this.rippleElement_.addEventListener("mouseup",this.boundRippleBlurHandler),this.element_.appendChild(e)}this.boundButtonBlurHandler=this.blurHandler_.bind(this),this.element_.addEventListener("mouseup",this.boundButtonBlurHandler),this.element_.addEventListener("mouseleave",this.boundButtonBlurHandler)}},s.register({constructor:o,classAsString:"MaterialButton",cssClass:"mdl-js-button",widget:!0});var r=function(e){this.element_=e,this.init()};window.MaterialCheckbox=r,r.prototype.Constant_={TINY_TIMEOUT:.001},r.prototype.CssClasses_={INPUT:"mdl-checkbox__input",BOX_OUTLINE:"mdl-checkbox__box-outline",FOCUS_HELPER:"mdl-checkbox__focus-helper",TICK_OUTLINE:"mdl-checkbox__tick-outline",RIPPLE_EFFECT:"mdl-js-ripple-effect",RIPPLE_IGNORE_EVENTS:"mdl-js-ripple-effect--ignore-events",RIPPLE_CONTAINER:"mdl-checkbox__ripple-container",RIPPLE_CENTER:"mdl-ripple--center",RIPPLE:"mdl-ripple",IS_FOCUSED:"is-focused",IS_DISABLED:"is-disabled",IS_CHECKED:"is-checked",IS_UPGRADED:"is-upgraded"},r.prototype.onChange_=function(e){this.updateClasses_()},r.prototype.onFocus_=function(e){this.element_.classList.add(this.CssClasses_.IS_FOCUSED)},r.prototype.onBlur_=function(e){this.element_.classList.remove(this.CssClasses_.IS_FOCUSED)},r.prototype.onMouseUp_=function(e){this.blur_()},r.prototype.updateClasses_=function(){this.checkDisabled(),this.checkToggleState()},r.prototype.blur_=function(){window.setTimeout(function(){this.inputElement_.blur()}.bind(this),this.Constant_.TINY_TIMEOUT)},r.prototype.checkToggleState=function(){this.inputElement_.checked?this.element_.classList.add(this.CssClasses_.IS_CHECKED):this.element_.classList.remove(this.CssClasses_.IS_CHECKED)},r.prototype.checkToggleState=r.prototype.checkToggleState,r.prototype.checkDisabled=function(){this.inputElement_.disabled?this.element_.classList.add(this.CssClasses_.IS_DISABLED):this.element_.classList.remove(this.CssClasses_.IS_DISABLED)},r.prototype.checkDisabled=r.prototype.checkDisabled,r.prototype.disable=function(){this.inputElement_.disabled=!0,this.updateClasses_()},r.prototype.disable=r.prototype.disable,r.prototype.enable=function(){this.inputElement_.disabled=!1,this.updateClasses_()},r.prototype.enable=r.prototype.enable,r.prototype.check=function(){this.inputElement_.checked=!0,this.updateClasses_()},r.prototype.check=r.prototype.check,r.prototype.uncheck=function(){this.inputElement_.checked=!1,this.updateClasses_()},r.prototype.uncheck=r.prototype.uncheck,r.prototype.init=function(){if(this.element_){this.inputElement_=this.element_.querySelector("."+this.CssClasses_.INPUT);var e=document.createElement("span");e.classList.add(this.CssClasses_.BOX_OUTLINE);var t=document.createElement("span");t.classList.add(this.CssClasses_.FOCUS_HELPER);var s=document.createElement("span");if(s.classList.add(this.CssClasses_.TICK_OUTLINE),e.appendChild(s),this.element_.appendChild(t),this.element_.appendChild(e),this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT)){this.element_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS),this.rippleContainerElement_=document.createElement("span"),this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CONTAINER),this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_EFFECT),this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CENTER),this.boundRippleMouseUp=this.onMouseUp_.bind(this),this.rippleContainerElement_.addEventListener("mouseup",this.boundRippleMouseUp);var i=document.createElement("span");i.classList.add(this.CssClasses_.RIPPLE),this.rippleContainerElement_.appendChild(i),this.element_.appendChild(this.rippleContainerElement_)}this.boundInputOnChange=this.onChange_.bind(this),this.boundInputOnFocus=this.onFocus_.bind(this),this.boundInputOnBlur=this.onBlur_.bind(this),this.boundElementMouseUp=this.onMouseUp_.bind(this),this.inputElement_.addEventListener("change",this.boundInputOnChange),this.inputElement_.addEventListener("focus",this.boundInputOnFocus),this.inputElement_.addEventListener("blur",this.boundInputOnBlur),this.element_.addEventListener("mouseup",this.boundElementMouseUp),this.updateClasses_(),this.element_.classList.add(this.CssClasses_.IS_UPGRADED)}},s.register({constructor:r,classAsString:"MaterialCheckbox",cssClass:"mdl-js-checkbox",widget:!0});var _=function(e){this.element_=e,this.init()};window.MaterialIconToggle=_,_.prototype.Constant_={TINY_TIMEOUT:.001},_.prototype.CssClasses_={INPUT:"mdl-icon-toggle__input",JS_RIPPLE_EFFECT:"mdl-js-ripple-effect",RIPPLE_IGNORE_EVENTS:"mdl-js-ripple-effect--ignore-events",RIPPLE_CONTAINER:"mdl-icon-toggle__ripple-container",RIPPLE_CENTER:"mdl-ripple--center",RIPPLE:"mdl-ripple",IS_FOCUSED:"is-focused",IS_DISABLED:"is-disabled",IS_CHECKED:"is-checked"},_.prototype.onChange_=function(e){this.updateClasses_()},_.prototype.onFocus_=function(e){this.element_.classList.add(this.CssClasses_.IS_FOCUSED)},_.prototype.onBlur_=function(e){this.element_.classList.remove(this.CssClasses_.IS_FOCUSED)},_.prototype.onMouseUp_=function(e){this.blur_()},_.prototype.updateClasses_=function(){this.checkDisabled(),this.checkToggleState()},_.prototype.blur_=function(){window.setTimeout(function(){this.inputElement_.blur()}.bind(this),this.Constant_.TINY_TIMEOUT)},_.prototype.checkToggleState=function(){this.inputElement_.checked?this.element_.classList.add(this.CssClasses_.IS_CHECKED):this.element_.classList.remove(this.CssClasses_.IS_CHECKED)},_.prototype.checkToggleState=_.prototype.checkToggleState,_.prototype.checkDisabled=function(){this.inputElement_.disabled?this.element_.classList.add(this.CssClasses_.IS_DISABLED):this.element_.classList.remove(this.CssClasses_.IS_DISABLED)},_.prototype.checkDisabled=_.prototype.checkDisabled,_.prototype.disable=function(){this.inputElement_.disabled=!0,this.updateClasses_()},_.prototype.disable=_.prototype.disable,_.prototype.enable=function(){this.inputElement_.disabled=!1,this.updateClasses_()},_.prototype.enable=_.prototype.enable,_.prototype.check=function(){this.inputElement_.checked=!0,this.updateClasses_()},_.prototype.check=_.prototype.check,_.prototype.uncheck=function(){this.inputElement_.checked=!1,this.updateClasses_()},_.prototype.uncheck=_.prototype.uncheck,_.prototype.init=function(){if(this.element_){if(this.inputElement_=this.element_.querySelector("."+this.CssClasses_.INPUT),this.element_.classList.contains(this.CssClasses_.JS_RIPPLE_EFFECT)){this.element_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS),this.rippleContainerElement_=document.createElement("span"),this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CONTAINER),this.rippleContainerElement_.classList.add(this.CssClasses_.JS_RIPPLE_EFFECT),this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CENTER),this.boundRippleMouseUp=this.onMouseUp_.bind(this),this.rippleContainerElement_.addEventListener("mouseup",this.boundRippleMouseUp);var e=document.createElement("span");e.classList.add(this.CssClasses_.RIPPLE),this.rippleContainerElement_.appendChild(e),this.element_.appendChild(this.rippleContainerElement_)}this.boundInputOnChange=this.onChange_.bind(this),this.boundInputOnFocus=this.onFocus_.bind(this),this.boundInputOnBlur=this.onBlur_.bind(this),this.boundElementOnMouseUp=this.onMouseUp_.bind(this),this.inputElement_.addEventListener("change",this.boundInputOnChange),this.inputElement_.addEventListener("focus",this.boundInputOnFocus),this.inputElement_.addEventListener("blur",this.boundInputOnBlur),this.element_.addEventListener("mouseup",this.boundElementOnMouseUp),this.updateClasses_(),this.element_.classList.add("is-upgraded")}},s.register({constructor:_,classAsString:"MaterialIconToggle",cssClass:"mdl-js-icon-toggle",widget:!0});var d=function(e){this.element_=e,this.init()};window.MaterialMenu=d,d.prototype.Constant_={TRANSITION_DURATION_SECONDS:.3,TRANSITION_DURATION_FRACTION:.8,CLOSE_TIMEOUT:150},d.prototype.Keycodes_={ENTER:13,ESCAPE:27,SPACE:32,UP_ARROW:38,DOWN_ARROW:40},d.prototype.CssClasses_={CONTAINER:"mdl-menu__container",OUTLINE:"mdl-menu__outline",ITEM:"mdl-menu__item",ITEM_RIPPLE_CONTAINER:"mdl-menu__item-ripple-container",RIPPLE_EFFECT:"mdl-js-ripple-effect",RIPPLE_IGNORE_EVENTS:"mdl-js-ripple-effect--ignore-events",RIPPLE:"mdl-ripple",IS_UPGRADED:"is-upgraded",IS_VISIBLE:"is-visible",IS_ANIMATING:"is-animating",BOTTOM_LEFT:"mdl-menu--bottom-left",BOTTOM_RIGHT:"mdl-menu--bottom-right",TOP_LEFT:"mdl-menu--top-left",TOP_RIGHT:"mdl-menu--top-right",UNALIGNED:"mdl-menu--unaligned"},d.prototype.init=function(){if(this.element_){var e=document.createElement("div");e.classList.add(this.CssClasses_.CONTAINER),this.element_.parentElement.insertBefore(e,this.element_),this.element_.parentElement.removeChild(this.element_),e.appendChild(this.element_),this.container_=e;var t=document.createElement("div");t.classList.add(this.CssClasses_.OUTLINE),this.outline_=t,e.insertBefore(t,this.element_);var s=this.element_.getAttribute("for")||this.element_.getAttribute("data-mdl-for"),i=null;s&&(i=document.getElementById(s),i&&(this.forElement_=i,i.addEventListener("click",this.handleForClick_.bind(this)),i.addEventListener("keydown",this.handleForKeyboardEvent_.bind(this))));var n=this.element_.querySelectorAll("."+this.CssClasses_.ITEM);this.boundItemKeydown_=this.handleItemKeyboardEvent_.bind(this),this.boundItemClick_=this.handleItemClick_.bind(this);for(var a=0;a<n.length;a++)n[a].addEventListener("click",this.boundItemClick_),n[a].tabIndex="-1",n[a].addEventListener("keydown",this.boundItemKeydown_);if(this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT))for(this.element_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS),a=0;a<n.length;a++){var l=n[a],o=document.createElement("span");o.classList.add(this.CssClasses_.ITEM_RIPPLE_CONTAINER);var r=document.createElement("span");r.classList.add(this.CssClasses_.RIPPLE),o.appendChild(r),l.appendChild(o),l.classList.add(this.CssClasses_.RIPPLE_EFFECT)}this.element_.classList.contains(this.CssClasses_.BOTTOM_LEFT)&&this.outline_.classList.add(this.CssClasses_.BOTTOM_LEFT),this.element_.classList.contains(this.CssClasses_.BOTTOM_RIGHT)&&this.outline_.classList.add(this.CssClasses_.BOTTOM_RIGHT),this.element_.classList.contains(this.CssClasses_.TOP_LEFT)&&this.outline_.classList.add(this.CssClasses_.TOP_LEFT),this.element_.classList.contains(this.CssClasses_.TOP_RIGHT)&&this.outline_.classList.add(this.CssClasses_.TOP_RIGHT),this.element_.classList.contains(this.CssClasses_.UNALIGNED)&&this.outline_.classList.add(this.CssClasses_.UNALIGNED),e.classList.add(this.CssClasses_.IS_UPGRADED)}},d.prototype.handleForClick_=function(e){if(this.element_&&this.forElement_){var t=this.forElement_.getBoundingClientRect(),s=this.forElement_.parentElement.getBoundingClientRect();this.element_.classList.contains(this.CssClasses_.UNALIGNED)||(this.element_.classList.contains(this.CssClasses_.BOTTOM_RIGHT)?(this.container_.style.right=s.right-t.right+"px",this.container_.style.top=this.forElement_.offsetTop+this.forElement_.offsetHeight+"px"):this.element_.classList.contains(this.CssClasses_.TOP_LEFT)?(this.container_.style.left=this.forElement_.offsetLeft+"px",this.container_.style.bottom=s.bottom-t.top+"px"):this.element_.classList.contains(this.CssClasses_.TOP_RIGHT)?(this.container_.style.right=s.right-t.right+"px",this.container_.style.bottom=s.bottom-t.top+"px"):(this.container_.style.left=this.forElement_.offsetLeft+"px",this.container_.style.top=this.forElement_.offsetTop+this.forElement_.offsetHeight+"px"))}this.toggle(e)},d.prototype.handleForKeyboardEvent_=function(e){if(this.element_&&this.container_&&this.forElement_){var t=this.element_.querySelectorAll("."+this.CssClasses_.ITEM+":not([disabled])");t&&t.length>0&&this.container_.classList.contains(this.CssClasses_.IS_VISIBLE)&&(e.keyCode===this.Keycodes_.UP_ARROW?(e.preventDefault(),t[t.length-1].focus()):e.keyCode===this.Keycodes_.DOWN_ARROW&&(e.preventDefault(),t[0].focus()))}},d.prototype.handleItemKeyboardEvent_=function(e){if(this.element_&&this.container_){var t=this.element_.querySelectorAll("."+this.CssClasses_.ITEM+":not([disabled])");if(t&&t.length>0&&this.container_.classList.contains(this.CssClasses_.IS_VISIBLE)){var s=Array.prototype.slice.call(t).indexOf(e.target);if(e.keyCode===this.Keycodes_.UP_ARROW)e.preventDefault(),s>0?t[s-1].focus():t[t.length-1].focus();else if(e.keyCode===this.Keycodes_.DOWN_ARROW)e.preventDefault(),t.length>s+1?t[s+1].focus():t[0].focus();else if(e.keyCode===this.Keycodes_.SPACE||e.keyCode===this.Keycodes_.ENTER){e.preventDefault();var i=new MouseEvent("mousedown");e.target.dispatchEvent(i),i=new MouseEvent("mouseup"),e.target.dispatchEvent(i),e.target.click()}else e.keyCode===this.Keycodes_.ESCAPE&&(e.preventDefault(),this.hide())}}},d.prototype.handleItemClick_=function(e){e.target.hasAttribute("disabled")?e.stopPropagation():(this.closing_=!0,window.setTimeout(function(e){this.hide(),this.closing_=!1}.bind(this),this.Constant_.CLOSE_TIMEOUT))},d.prototype.applyClip_=function(e,t){this.element_.classList.contains(this.CssClasses_.UNALIGNED)?this.element_.style.clip="":this.element_.classList.contains(this.CssClasses_.BOTTOM_RIGHT)?this.element_.style.clip="rect(0 "+t+"px 0 "+t+"px)":this.element_.classList.contains(this.CssClasses_.TOP_LEFT)?this.element_.style.clip="rect("+e+"px 0 "+e+"px 0)":this.element_.classList.contains(this.CssClasses_.TOP_RIGHT)?this.element_.style.clip="rect("+e+"px "+t+"px "+e+"px "+t+"px)":this.element_.style.clip=""},d.prototype.removeAnimationEndListener_=function(e){e.target.classList.remove(d.prototype.CssClasses_.IS_ANIMATING)},d.prototype.addAnimationEndListener_=function(){this.element_.addEventListener("transitionend",this.removeAnimationEndListener_),this.element_.addEventListener("webkitTransitionEnd",this.removeAnimationEndListener_)},d.prototype.show=function(e){if(this.element_&&this.container_&&this.outline_){var t=this.element_.getBoundingClientRect().height,s=this.element_.getBoundingClientRect().width;this.container_.style.width=s+"px",this.container_.style.height=t+"px",this.outline_.style.width=s+"px",this.outline_.style.height=t+"px";for(var i=this.Constant_.TRANSITION_DURATION_SECONDS*this.Constant_.TRANSITION_DURATION_FRACTION,n=this.element_.querySelectorAll("."+this.CssClasses_.ITEM),a=0;a<n.length;a++){var l=null;l=this.element_.classList.contains(this.CssClasses_.TOP_LEFT)||this.element_.classList.contains(this.CssClasses_.TOP_RIGHT)?(t-n[a].offsetTop-n[a].offsetHeight)/t*i+"s":n[a].offsetTop/t*i+"s",n[a].style.transitionDelay=l}this.applyClip_(t,s),window.requestAnimationFrame(function(){this.element_.classList.add(this.CssClasses_.IS_ANIMATING),this.element_.style.clip="rect(0 "+s+"px "+t+"px 0)",this.container_.classList.add(this.CssClasses_.IS_VISIBLE)}.bind(this)),this.addAnimationEndListener_();var o=function(t){t===e||this.closing_||t.target.parentNode===this.element_||(document.removeEventListener("click",o),this.hide())}.bind(this);document.addEventListener("click",o)}},d.prototype.show=d.prototype.show,d.prototype.hide=function(){if(this.element_&&this.container_&&this.outline_){for(var e=this.element_.querySelectorAll("."+this.CssClasses_.ITEM),t=0;t<e.length;t++)e[t].style.removeProperty("transition-delay");var s=this.element_.getBoundingClientRect(),i=s.height,n=s.width;this.element_.classList.add(this.CssClasses_.IS_ANIMATING),this.applyClip_(i,n),this.container_.classList.remove(this.CssClasses_.IS_VISIBLE),this.addAnimationEndListener_()}},d.prototype.hide=d.prototype.hide,d.prototype.toggle=function(e){this.container_.classList.contains(this.CssClasses_.IS_VISIBLE)?this.hide():this.show(e)},d.prototype.toggle=d.prototype.toggle,s.register({constructor:d,classAsString:"MaterialMenu",cssClass:"mdl-js-menu",widget:!0});var h=function(e){this.element_=e,this.init()};window.MaterialProgress=h,h.prototype.Constant_={},h.prototype.CssClasses_={INDETERMINATE_CLASS:"mdl-progress__indeterminate"},h.prototype.setProgress=function(e){this.element_.classList.contains(this.CssClasses_.INDETERMINATE_CLASS)||(this.progressbar_.style.width=e+"%")},h.prototype.setProgress=h.prototype.setProgress,h.prototype.setBuffer=function(e){this.bufferbar_.style.width=e+"%",this.auxbar_.style.width=100-e+"%"},h.prototype.setBuffer=h.prototype.setBuffer,h.prototype.init=function(){if(this.element_){var e=document.createElement("div");e.className="progressbar bar bar1",this.element_.appendChild(e),this.progressbar_=e,e=document.createElement("div"),e.className="bufferbar bar bar2",this.element_.appendChild(e),this.bufferbar_=e,e=document.createElement("div"),e.className="auxbar bar bar3",this.element_.appendChild(e),this.auxbar_=e,this.progressbar_.style.width="0%",this.bufferbar_.style.width="100%",this.auxbar_.style.width="0%",this.element_.classList.add("is-upgraded")}},s.register({constructor:h,classAsString:"MaterialProgress",cssClass:"mdl-js-progress",widget:!0});var c=function(e){this.element_=e,this.init()};window.MaterialRadio=c,c.prototype.Constant_={TINY_TIMEOUT:.001},c.prototype.CssClasses_={IS_FOCUSED:"is-focused",IS_DISABLED:"is-disabled",IS_CHECKED:"is-checked",IS_UPGRADED:"is-upgraded",JS_RADIO:"mdl-js-radio",RADIO_BTN:"mdl-radio__button",RADIO_OUTER_CIRCLE:"mdl-radio__outer-circle",RADIO_INNER_CIRCLE:"mdl-radio__inner-circle",RIPPLE_EFFECT:"mdl-js-ripple-effect",RIPPLE_IGNORE_EVENTS:"mdl-js-ripple-effect--ignore-events",RIPPLE_CONTAINER:"mdl-radio__ripple-container",RIPPLE_CENTER:"mdl-ripple--center",RIPPLE:"mdl-ripple"},c.prototype.onChange_=function(e){for(var t=document.getElementsByClassName(this.CssClasses_.JS_RADIO),s=0;s<t.length;s++){var i=t[s].querySelector("."+this.CssClasses_.RADIO_BTN);i.getAttribute("name")===this.btnElement_.getAttribute("name")&&"undefined"!=typeof t[s].MaterialRadio&&t[s].MaterialRadio.updateClasses_()}},c.prototype.onFocus_=function(e){this.element_.classList.add(this.CssClasses_.IS_FOCUSED)},c.prototype.onBlur_=function(e){this.element_.classList.remove(this.CssClasses_.IS_FOCUSED)},c.prototype.onMouseup_=function(e){this.blur_()},c.prototype.updateClasses_=function(){this.checkDisabled(),this.checkToggleState()},c.prototype.blur_=function(){window.setTimeout(function(){this.btnElement_.blur()}.bind(this),this.Constant_.TINY_TIMEOUT)},c.prototype.checkDisabled=function(){this.btnElement_.disabled?this.element_.classList.add(this.CssClasses_.IS_DISABLED):this.element_.classList.remove(this.CssClasses_.IS_DISABLED)},c.prototype.checkDisabled=c.prototype.checkDisabled,c.prototype.checkToggleState=function(){this.btnElement_.checked?this.element_.classList.add(this.CssClasses_.IS_CHECKED):this.element_.classList.remove(this.CssClasses_.IS_CHECKED)},c.prototype.checkToggleState=c.prototype.checkToggleState,c.prototype.disable=function(){this.btnElement_.disabled=!0,this.updateClasses_()},c.prototype.disable=c.prototype.disable,c.prototype.enable=function(){this.btnElement_.disabled=!1,this.updateClasses_()},c.prototype.enable=c.prototype.enable,c.prototype.check=function(){this.btnElement_.checked=!0,this.onChange_(null)},c.prototype.check=c.prototype.check,c.prototype.uncheck=function(){this.btnElement_.checked=!1,this.onChange_(null)},c.prototype.uncheck=c.prototype.uncheck,c.prototype.init=function(){if(this.element_){this.btnElement_=this.element_.querySelector("."+this.CssClasses_.RADIO_BTN),this.boundChangeHandler_=this.onChange_.bind(this),this.boundFocusHandler_=this.onChange_.bind(this),this.boundBlurHandler_=this.onBlur_.bind(this),this.boundMouseUpHandler_=this.onMouseup_.bind(this);var e=document.createElement("span");e.classList.add(this.CssClasses_.RADIO_OUTER_CIRCLE);var t=document.createElement("span");t.classList.add(this.CssClasses_.RADIO_INNER_CIRCLE),this.element_.appendChild(e),this.element_.appendChild(t);var s;if(this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT)){this.element_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS),s=document.createElement("span"),s.classList.add(this.CssClasses_.RIPPLE_CONTAINER),s.classList.add(this.CssClasses_.RIPPLE_EFFECT),s.classList.add(this.CssClasses_.RIPPLE_CENTER),s.addEventListener("mouseup",this.boundMouseUpHandler_);var i=document.createElement("span");i.classList.add(this.CssClasses_.RIPPLE),s.appendChild(i),this.element_.appendChild(s)}this.btnElement_.addEventListener("change",this.boundChangeHandler_),this.btnElement_.addEventListener("focus",this.boundFocusHandler_),this.btnElement_.addEventListener("blur",this.boundBlurHandler_),this.element_.addEventListener("mouseup",this.boundMouseUpHandler_),this.updateClasses_(),this.element_.classList.add(this.CssClasses_.IS_UPGRADED)}},s.register({constructor:c,classAsString:"MaterialRadio",cssClass:"mdl-js-radio",widget:!0});var p=function(e){this.element_=e,this.isIE_=window.navigator.msPointerEnabled,this.init()};window.MaterialSlider=p,p.prototype.Constant_={},p.prototype.CssClasses_={IE_CONTAINER:"mdl-slider__ie-container",SLIDER_CONTAINER:"mdl-slider__container",BACKGROUND_FLEX:"mdl-slider__background-flex",BACKGROUND_LOWER:"mdl-slider__background-lower",BACKGROUND_UPPER:"mdl-slider__background-upper",IS_LOWEST_VALUE:"is-lowest-value",IS_UPGRADED:"is-upgraded"},p.prototype.onInput_=function(e){this.updateValueStyles_()},p.prototype.onChange_=function(e){this.updateValueStyles_()},p.prototype.onMouseUp_=function(e){e.target.blur()},p.prototype.onContainerMouseDown_=function(e){if(e.target===this.element_.parentElement){e.preventDefault();var t=new MouseEvent("mousedown",{target:e.target,buttons:e.buttons,clientX:e.clientX,clientY:this.element_.getBoundingClientRect().y});this.element_.dispatchEvent(t)}},p.prototype.updateValueStyles_=function(){var e=(this.element_.value-this.element_.min)/(this.element_.max-this.element_.min);0===e?this.element_.classList.add(this.CssClasses_.IS_LOWEST_VALUE):this.element_.classList.remove(this.CssClasses_.IS_LOWEST_VALUE),this.isIE_||(this.backgroundLower_.style.flex=e,this.backgroundLower_.style.webkitFlex=e,this.backgroundUpper_.style.flex=1-e,this.backgroundUpper_.style.webkitFlex=1-e)},p.prototype.disable=function(){this.element_.disabled=!0},p.prototype.disable=p.prototype.disable,p.prototype.enable=function(){this.element_.disabled=!1},p.prototype.enable=p.prototype.enable,p.prototype.change=function(e){"undefined"!=typeof e&&(this.element_.value=e),this.updateValueStyles_()},p.prototype.change=p.prototype.change,p.prototype.init=function(){if(this.element_){if(this.isIE_){var e=document.createElement("div");e.classList.add(this.CssClasses_.IE_CONTAINER),this.element_.parentElement.insertBefore(e,this.element_),this.element_.parentElement.removeChild(this.element_),e.appendChild(this.element_)}else{var t=document.createElement("div");t.classList.add(this.CssClasses_.SLIDER_CONTAINER),this.element_.parentElement.insertBefore(t,this.element_),this.element_.parentElement.removeChild(this.element_),t.appendChild(this.element_);var s=document.createElement("div");s.classList.add(this.CssClasses_.BACKGROUND_FLEX),t.appendChild(s),this.backgroundLower_=document.createElement("div"),this.backgroundLower_.classList.add(this.CssClasses_.BACKGROUND_LOWER),s.appendChild(this.backgroundLower_),this.backgroundUpper_=document.createElement("div"),this.backgroundUpper_.classList.add(this.CssClasses_.BACKGROUND_UPPER),s.appendChild(this.backgroundUpper_)}this.boundInputHandler=this.onInput_.bind(this),this.boundChangeHandler=this.onChange_.bind(this),this.boundMouseUpHandler=this.onMouseUp_.bind(this),this.boundContainerMouseDownHandler=this.onContainerMouseDown_.bind(this),this.element_.addEventListener("input",this.boundInputHandler),this.element_.addEventListener("change",this.boundChangeHandler),this.element_.addEventListener("mouseup",this.boundMouseUpHandler),this.element_.parentElement.addEventListener("mousedown",this.boundContainerMouseDownHandler),this.updateValueStyles_(),this.element_.classList.add(this.CssClasses_.IS_UPGRADED)}},s.register({constructor:p,classAsString:"MaterialSlider",cssClass:"mdl-js-slider",widget:!0});var C=function(e){if(this.element_=e,this.textElement_=this.element_.querySelector("."+this.cssClasses_.MESSAGE),this.actionElement_=this.element_.querySelector("."+this.cssClasses_.ACTION),!this.textElement_)throw new Error("There must be a message element for a snackbar.");if(!this.actionElement_)throw new Error("There must be an action element for a snackbar.");this.active=!1,this.actionHandler_=void 0,this.message_=void 0,this.actionText_=void 0,this.queuedNotifications_=[],this.setActionHidden_(!0)};window.MaterialSnackbar=C,C.prototype.Constant_={ANIMATION_LENGTH:250},C.prototype.cssClasses_={SNACKBAR:"mdl-snackbar",MESSAGE:"mdl-snackbar__text",ACTION:"mdl-snackbar__action",ACTIVE:"mdl-snackbar--active"},C.prototype.displaySnackbar_=function(){this.element_.setAttribute("aria-hidden","true"),this.actionHandler_&&(this.actionElement_.textContent=this.actionText_,
this.actionElement_.addEventListener("click",this.actionHandler_),this.setActionHidden_(!1)),this.textElement_.textContent=this.message_,this.element_.classList.add(this.cssClasses_.ACTIVE),this.element_.setAttribute("aria-hidden","false"),setTimeout(this.cleanup_.bind(this),this.timeout_)},C.prototype.showSnackbar=function(e){if(void 0===e)throw new Error("Please provide a data object with at least a message to display.");if(void 0===e.message)throw new Error("Please provide a message to be displayed.");if(e.actionHandler&&!e.actionText)throw new Error("Please provide action text with the handler.");this.active?this.queuedNotifications_.push(e):(this.active=!0,this.message_=e.message,e.timeout?this.timeout_=e.timeout:this.timeout_=2750,e.actionHandler&&(this.actionHandler_=e.actionHandler),e.actionText&&(this.actionText_=e.actionText),this.displaySnackbar_())},C.prototype.showSnackbar=C.prototype.showSnackbar,C.prototype.checkQueue_=function(){this.queuedNotifications_.length>0&&this.showSnackbar(this.queuedNotifications_.shift())},C.prototype.cleanup_=function(){this.element_.classList.remove(this.cssClasses_.ACTIVE),setTimeout(function(){this.element_.setAttribute("aria-hidden","true"),this.textElement_.textContent="",Boolean(this.actionElement_.getAttribute("aria-hidden"))||(this.setActionHidden_(!0),this.actionElement_.textContent="",this.actionElement_.removeEventListener("click",this.actionHandler_)),this.actionHandler_=void 0,this.message_=void 0,this.actionText_=void 0,this.active=!1,this.checkQueue_()}.bind(this),this.Constant_.ANIMATION_LENGTH)},C.prototype.setActionHidden_=function(e){e?this.actionElement_.setAttribute("aria-hidden","true"):this.actionElement_.removeAttribute("aria-hidden")},s.register({constructor:C,classAsString:"MaterialSnackbar",cssClass:"mdl-js-snackbar",widget:!0});var u=function(e){this.element_=e,this.init()};window.MaterialSpinner=u,u.prototype.Constant_={MDL_SPINNER_LAYER_COUNT:4},u.prototype.CssClasses_={MDL_SPINNER_LAYER:"mdl-spinner__layer",MDL_SPINNER_CIRCLE_CLIPPER:"mdl-spinner__circle-clipper",MDL_SPINNER_CIRCLE:"mdl-spinner__circle",MDL_SPINNER_GAP_PATCH:"mdl-spinner__gap-patch",MDL_SPINNER_LEFT:"mdl-spinner__left",MDL_SPINNER_RIGHT:"mdl-spinner__right"},u.prototype.createLayer=function(e){var t=document.createElement("div");t.classList.add(this.CssClasses_.MDL_SPINNER_LAYER),t.classList.add(this.CssClasses_.MDL_SPINNER_LAYER+"-"+e);var s=document.createElement("div");s.classList.add(this.CssClasses_.MDL_SPINNER_CIRCLE_CLIPPER),s.classList.add(this.CssClasses_.MDL_SPINNER_LEFT);var i=document.createElement("div");i.classList.add(this.CssClasses_.MDL_SPINNER_GAP_PATCH);var n=document.createElement("div");n.classList.add(this.CssClasses_.MDL_SPINNER_CIRCLE_CLIPPER),n.classList.add(this.CssClasses_.MDL_SPINNER_RIGHT);for(var a=[s,i,n],l=0;l<a.length;l++){var o=document.createElement("div");o.classList.add(this.CssClasses_.MDL_SPINNER_CIRCLE),a[l].appendChild(o)}t.appendChild(s),t.appendChild(i),t.appendChild(n),this.element_.appendChild(t)},u.prototype.createLayer=u.prototype.createLayer,u.prototype.stop=function(){this.element_.classList.remove("is-active")},u.prototype.stop=u.prototype.stop,u.prototype.start=function(){this.element_.classList.add("is-active")},u.prototype.start=u.prototype.start,u.prototype.init=function(){if(this.element_){for(var e=1;e<=this.Constant_.MDL_SPINNER_LAYER_COUNT;e++)this.createLayer(e);this.element_.classList.add("is-upgraded")}},s.register({constructor:u,classAsString:"MaterialSpinner",cssClass:"mdl-js-spinner",widget:!0});var E=function(e){this.element_=e,this.init()};window.MaterialSwitch=E,E.prototype.Constant_={TINY_TIMEOUT:.001},E.prototype.CssClasses_={INPUT:"mdl-switch__input",TRACK:"mdl-switch__track",THUMB:"mdl-switch__thumb",FOCUS_HELPER:"mdl-switch__focus-helper",RIPPLE_EFFECT:"mdl-js-ripple-effect",RIPPLE_IGNORE_EVENTS:"mdl-js-ripple-effect--ignore-events",RIPPLE_CONTAINER:"mdl-switch__ripple-container",RIPPLE_CENTER:"mdl-ripple--center",RIPPLE:"mdl-ripple",IS_FOCUSED:"is-focused",IS_DISABLED:"is-disabled",IS_CHECKED:"is-checked"},E.prototype.onChange_=function(e){this.updateClasses_()},E.prototype.onFocus_=function(e){this.element_.classList.add(this.CssClasses_.IS_FOCUSED)},E.prototype.onBlur_=function(e){this.element_.classList.remove(this.CssClasses_.IS_FOCUSED)},E.prototype.onMouseUp_=function(e){this.blur_()},E.prototype.updateClasses_=function(){this.checkDisabled(),this.checkToggleState()},E.prototype.blur_=function(){window.setTimeout(function(){this.inputElement_.blur()}.bind(this),this.Constant_.TINY_TIMEOUT)},E.prototype.checkDisabled=function(){this.inputElement_.disabled?this.element_.classList.add(this.CssClasses_.IS_DISABLED):this.element_.classList.remove(this.CssClasses_.IS_DISABLED)},E.prototype.checkDisabled=E.prototype.checkDisabled,E.prototype.checkToggleState=function(){this.inputElement_.checked?this.element_.classList.add(this.CssClasses_.IS_CHECKED):this.element_.classList.remove(this.CssClasses_.IS_CHECKED)},E.prototype.checkToggleState=E.prototype.checkToggleState,E.prototype.disable=function(){this.inputElement_.disabled=!0,this.updateClasses_()},E.prototype.disable=E.prototype.disable,E.prototype.enable=function(){this.inputElement_.disabled=!1,this.updateClasses_()},E.prototype.enable=E.prototype.enable,E.prototype.on=function(){this.inputElement_.checked=!0,this.updateClasses_()},E.prototype.on=E.prototype.on,E.prototype.off=function(){this.inputElement_.checked=!1,this.updateClasses_()},E.prototype.off=E.prototype.off,E.prototype.init=function(){if(this.element_){this.inputElement_=this.element_.querySelector("."+this.CssClasses_.INPUT);var e=document.createElement("div");e.classList.add(this.CssClasses_.TRACK);var t=document.createElement("div");t.classList.add(this.CssClasses_.THUMB);var s=document.createElement("span");if(s.classList.add(this.CssClasses_.FOCUS_HELPER),t.appendChild(s),this.element_.appendChild(e),this.element_.appendChild(t),this.boundMouseUpHandler=this.onMouseUp_.bind(this),this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT)){this.element_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS),this.rippleContainerElement_=document.createElement("span"),this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CONTAINER),this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_EFFECT),this.rippleContainerElement_.classList.add(this.CssClasses_.RIPPLE_CENTER),this.rippleContainerElement_.addEventListener("mouseup",this.boundMouseUpHandler);var i=document.createElement("span");i.classList.add(this.CssClasses_.RIPPLE),this.rippleContainerElement_.appendChild(i),this.element_.appendChild(this.rippleContainerElement_)}this.boundChangeHandler=this.onChange_.bind(this),this.boundFocusHandler=this.onFocus_.bind(this),this.boundBlurHandler=this.onBlur_.bind(this),this.inputElement_.addEventListener("change",this.boundChangeHandler),this.inputElement_.addEventListener("focus",this.boundFocusHandler),this.inputElement_.addEventListener("blur",this.boundBlurHandler),this.element_.addEventListener("mouseup",this.boundMouseUpHandler),this.updateClasses_(),this.element_.classList.add("is-upgraded")}},s.register({constructor:E,classAsString:"MaterialSwitch",cssClass:"mdl-js-switch",widget:!0});var m=function(e){this.element_=e,this.init()};window.MaterialTabs=m,m.prototype.Constant_={},m.prototype.CssClasses_={TAB_CLASS:"mdl-tabs__tab",PANEL_CLASS:"mdl-tabs__panel",ACTIVE_CLASS:"is-active",UPGRADED_CLASS:"is-upgraded",MDL_JS_RIPPLE_EFFECT:"mdl-js-ripple-effect",MDL_RIPPLE_CONTAINER:"mdl-tabs__ripple-container",MDL_RIPPLE:"mdl-ripple",MDL_JS_RIPPLE_EFFECT_IGNORE_EVENTS:"mdl-js-ripple-effect--ignore-events"},m.prototype.initTabs_=function(){this.element_.classList.contains(this.CssClasses_.MDL_JS_RIPPLE_EFFECT)&&this.element_.classList.add(this.CssClasses_.MDL_JS_RIPPLE_EFFECT_IGNORE_EVENTS),this.tabs_=this.element_.querySelectorAll("."+this.CssClasses_.TAB_CLASS),this.panels_=this.element_.querySelectorAll("."+this.CssClasses_.PANEL_CLASS);for(var t=0;t<this.tabs_.length;t++)new e(this.tabs_[t],this);this.element_.classList.add(this.CssClasses_.UPGRADED_CLASS)},m.prototype.resetTabState_=function(){for(var e=0;e<this.tabs_.length;e++)this.tabs_[e].classList.remove(this.CssClasses_.ACTIVE_CLASS)},m.prototype.resetPanelState_=function(){for(var e=0;e<this.panels_.length;e++)this.panels_[e].classList.remove(this.CssClasses_.ACTIVE_CLASS)},m.prototype.init=function(){this.element_&&this.initTabs_()},s.register({constructor:m,classAsString:"MaterialTabs",cssClass:"mdl-js-tabs"});var L=function(e){this.element_=e,this.maxRows=this.Constant_.NO_MAX_ROWS,this.init()};window.MaterialTextfield=L,L.prototype.Constant_={NO_MAX_ROWS:-1,MAX_ROWS_ATTRIBUTE:"maxrows"},L.prototype.CssClasses_={LABEL:"mdl-textfield__label",INPUT:"mdl-textfield__input",IS_DIRTY:"is-dirty",IS_FOCUSED:"is-focused",IS_DISABLED:"is-disabled",IS_INVALID:"is-invalid",IS_UPGRADED:"is-upgraded",HAS_PLACEHOLDER:"has-placeholder"},L.prototype.onKeyDown_=function(e){var t=e.target.value.split("\n").length;13===e.keyCode&&t>=this.maxRows&&e.preventDefault()},L.prototype.onFocus_=function(e){this.element_.classList.add(this.CssClasses_.IS_FOCUSED)},L.prototype.onBlur_=function(e){this.element_.classList.remove(this.CssClasses_.IS_FOCUSED)},L.prototype.onReset_=function(e){this.updateClasses_()},L.prototype.updateClasses_=function(){this.checkDisabled(),this.checkValidity(),this.checkDirty(),this.checkFocus()},L.prototype.checkDisabled=function(){this.input_.disabled?this.element_.classList.add(this.CssClasses_.IS_DISABLED):this.element_.classList.remove(this.CssClasses_.IS_DISABLED)},L.prototype.checkDisabled=L.prototype.checkDisabled,L.prototype.checkFocus=function(){Boolean(this.element_.querySelector(":focus"))?this.element_.classList.add(this.CssClasses_.IS_FOCUSED):this.element_.classList.remove(this.CssClasses_.IS_FOCUSED)},L.prototype.checkFocus=L.prototype.checkFocus,L.prototype.checkValidity=function(){this.input_.validity&&(this.input_.validity.valid?this.element_.classList.remove(this.CssClasses_.IS_INVALID):this.element_.classList.add(this.CssClasses_.IS_INVALID))},L.prototype.checkValidity=L.prototype.checkValidity,L.prototype.checkDirty=function(){this.input_.value&&this.input_.value.length>0?this.element_.classList.add(this.CssClasses_.IS_DIRTY):this.element_.classList.remove(this.CssClasses_.IS_DIRTY)},L.prototype.checkDirty=L.prototype.checkDirty,L.prototype.disable=function(){this.input_.disabled=!0,this.updateClasses_()},L.prototype.disable=L.prototype.disable,L.prototype.enable=function(){this.input_.disabled=!1,this.updateClasses_()},L.prototype.enable=L.prototype.enable,L.prototype.change=function(e){this.input_.value=e||"",this.updateClasses_()},L.prototype.change=L.prototype.change,L.prototype.init=function(){if(this.element_&&(this.label_=this.element_.querySelector("."+this.CssClasses_.LABEL),this.input_=this.element_.querySelector("."+this.CssClasses_.INPUT),this.input_)){this.input_.hasAttribute(this.Constant_.MAX_ROWS_ATTRIBUTE)&&(this.maxRows=parseInt(this.input_.getAttribute(this.Constant_.MAX_ROWS_ATTRIBUTE),10),isNaN(this.maxRows)&&(this.maxRows=this.Constant_.NO_MAX_ROWS)),this.input_.hasAttribute("placeholder")&&this.element_.classList.add(this.CssClasses_.HAS_PLACEHOLDER),this.boundUpdateClassesHandler=this.updateClasses_.bind(this),this.boundFocusHandler=this.onFocus_.bind(this),this.boundBlurHandler=this.onBlur_.bind(this),this.boundResetHandler=this.onReset_.bind(this),this.input_.addEventListener("input",this.boundUpdateClassesHandler),this.input_.addEventListener("focus",this.boundFocusHandler),this.input_.addEventListener("blur",this.boundBlurHandler),this.input_.addEventListener("reset",this.boundResetHandler),this.maxRows!==this.Constant_.NO_MAX_ROWS&&(this.boundKeyDownHandler=this.onKeyDown_.bind(this),this.input_.addEventListener("keydown",this.boundKeyDownHandler));var e=this.element_.classList.contains(this.CssClasses_.IS_INVALID);this.updateClasses_(),this.element_.classList.add(this.CssClasses_.IS_UPGRADED),e&&this.element_.classList.add(this.CssClasses_.IS_INVALID),this.input_.hasAttribute("autofocus")&&(this.element_.focus(),this.checkFocus())}},s.register({constructor:L,classAsString:"MaterialTextfield",cssClass:"mdl-js-textfield",widget:!0});var I=function(e){this.element_=e,this.init()};window.MaterialTooltip=I,I.prototype.Constant_={},I.prototype.CssClasses_={IS_ACTIVE:"is-active",BOTTOM:"mdl-tooltip--bottom",LEFT:"mdl-tooltip--left",RIGHT:"mdl-tooltip--right",TOP:"mdl-tooltip--top"},I.prototype.handleMouseEnter_=function(e){var t=e.target.getBoundingClientRect(),s=t.left+t.width/2,i=t.top+t.height/2,n=-1*(this.element_.offsetWidth/2),a=-1*(this.element_.offsetHeight/2);this.element_.classList.contains(this.CssClasses_.LEFT)||this.element_.classList.contains(this.CssClasses_.RIGHT)?(s=t.width/2,i+a<0?(this.element_.style.top="0",this.element_.style.marginTop="0"):(this.element_.style.top=i+"px",this.element_.style.marginTop=a+"px")):s+n<0?(this.element_.style.left="0",this.element_.style.marginLeft="0"):(this.element_.style.left=s+"px",this.element_.style.marginLeft=n+"px"),this.element_.classList.contains(this.CssClasses_.TOP)?this.element_.style.top=t.top-this.element_.offsetHeight-10+"px":this.element_.classList.contains(this.CssClasses_.RIGHT)?this.element_.style.left=t.left+t.width+10+"px":this.element_.classList.contains(this.CssClasses_.LEFT)?this.element_.style.left=t.left-this.element_.offsetWidth-10+"px":this.element_.style.top=t.top+t.height+10+"px",this.element_.classList.add(this.CssClasses_.IS_ACTIVE)},I.prototype.hideTooltip_=function(){this.element_.classList.remove(this.CssClasses_.IS_ACTIVE)},I.prototype.init=function(){if(this.element_){var e=this.element_.getAttribute("for")||this.element_.getAttribute("data-mdl-for");e&&(this.forElement_=document.getElementById(e)),this.forElement_&&(this.forElement_.hasAttribute("tabindex")||this.forElement_.setAttribute("tabindex","0"),this.boundMouseEnterHandler=this.handleMouseEnter_.bind(this),this.boundMouseLeaveAndScrollHandler=this.hideTooltip_.bind(this),this.forElement_.addEventListener("mouseenter",this.boundMouseEnterHandler,!1),this.forElement_.addEventListener("touchend",this.boundMouseEnterHandler,!1),this.forElement_.addEventListener("mouseleave",this.boundMouseLeaveAndScrollHandler,!1),window.addEventListener("scroll",this.boundMouseLeaveAndScrollHandler,!0),window.addEventListener("touchstart",this.boundMouseLeaveAndScrollHandler))}},s.register({constructor:I,classAsString:"MaterialTooltip",cssClass:"mdl-tooltip"});var f=function(e){this.element_=e,this.init()};window.MaterialLayout=f,f.prototype.Constant_={MAX_WIDTH:"(max-width: 1024px)",TAB_SCROLL_PIXELS:100,RESIZE_TIMEOUT:100,MENU_ICON:"&#xE5D2;",CHEVRON_LEFT:"chevron_left",CHEVRON_RIGHT:"chevron_right"},f.prototype.Keycodes_={ENTER:13,ESCAPE:27,SPACE:32},f.prototype.Mode_={STANDARD:0,SEAMED:1,WATERFALL:2,SCROLL:3},f.prototype.CssClasses_={CONTAINER:"mdl-layout__container",HEADER:"mdl-layout__header",DRAWER:"mdl-layout__drawer",CONTENT:"mdl-layout__content",DRAWER_BTN:"mdl-layout__drawer-button",ICON:"material-icons",JS_RIPPLE_EFFECT:"mdl-js-ripple-effect",RIPPLE_CONTAINER:"mdl-layout__tab-ripple-container",RIPPLE:"mdl-ripple",RIPPLE_IGNORE_EVENTS:"mdl-js-ripple-effect--ignore-events",HEADER_SEAMED:"mdl-layout__header--seamed",HEADER_WATERFALL:"mdl-layout__header--waterfall",HEADER_SCROLL:"mdl-layout__header--scroll",FIXED_HEADER:"mdl-layout--fixed-header",OBFUSCATOR:"mdl-layout__obfuscator",TAB_BAR:"mdl-layout__tab-bar",TAB_CONTAINER:"mdl-layout__tab-bar-container",TAB:"mdl-layout__tab",TAB_BAR_BUTTON:"mdl-layout__tab-bar-button",TAB_BAR_LEFT_BUTTON:"mdl-layout__tab-bar-left-button",TAB_BAR_RIGHT_BUTTON:"mdl-layout__tab-bar-right-button",PANEL:"mdl-layout__tab-panel",HAS_DRAWER:"has-drawer",HAS_TABS:"has-tabs",HAS_SCROLLING_HEADER:"has-scrolling-header",CASTING_SHADOW:"is-casting-shadow",IS_COMPACT:"is-compact",IS_SMALL_SCREEN:"is-small-screen",IS_DRAWER_OPEN:"is-visible",IS_ACTIVE:"is-active",IS_UPGRADED:"is-upgraded",IS_ANIMATING:"is-animating",ON_LARGE_SCREEN:"mdl-layout--large-screen-only",ON_SMALL_SCREEN:"mdl-layout--small-screen-only"},f.prototype.contentScrollHandler_=function(){if(!this.header_.classList.contains(this.CssClasses_.IS_ANIMATING)){var e=!this.element_.classList.contains(this.CssClasses_.IS_SMALL_SCREEN)||this.element_.classList.contains(this.CssClasses_.FIXED_HEADER);this.content_.scrollTop>0&&!this.header_.classList.contains(this.CssClasses_.IS_COMPACT)?(this.header_.classList.add(this.CssClasses_.CASTING_SHADOW),this.header_.classList.add(this.CssClasses_.IS_COMPACT),e&&this.header_.classList.add(this.CssClasses_.IS_ANIMATING)):this.content_.scrollTop<=0&&this.header_.classList.contains(this.CssClasses_.IS_COMPACT)&&(this.header_.classList.remove(this.CssClasses_.CASTING_SHADOW),this.header_.classList.remove(this.CssClasses_.IS_COMPACT),e&&this.header_.classList.add(this.CssClasses_.IS_ANIMATING))}},f.prototype.keyboardEventHandler_=function(e){e.keyCode===this.Keycodes_.ESCAPE&&this.drawer_.classList.contains(this.CssClasses_.IS_DRAWER_OPEN)&&this.toggleDrawer()},f.prototype.screenSizeHandler_=function(){this.screenSizeMediaQuery_.matches?this.element_.classList.add(this.CssClasses_.IS_SMALL_SCREEN):(this.element_.classList.remove(this.CssClasses_.IS_SMALL_SCREEN),this.drawer_&&(this.drawer_.classList.remove(this.CssClasses_.IS_DRAWER_OPEN),this.obfuscator_.classList.remove(this.CssClasses_.IS_DRAWER_OPEN)))},f.prototype.drawerToggleHandler_=function(e){if(e&&"keydown"===e.type){if(e.keyCode!==this.Keycodes_.SPACE&&e.keyCode!==this.Keycodes_.ENTER)return;e.preventDefault()}this.toggleDrawer()},f.prototype.headerTransitionEndHandler_=function(){this.header_.classList.remove(this.CssClasses_.IS_ANIMATING)},f.prototype.headerClickHandler_=function(){this.header_.classList.contains(this.CssClasses_.IS_COMPACT)&&(this.header_.classList.remove(this.CssClasses_.IS_COMPACT),this.header_.classList.add(this.CssClasses_.IS_ANIMATING))},f.prototype.resetTabState_=function(e){for(var t=0;t<e.length;t++)e[t].classList.remove(this.CssClasses_.IS_ACTIVE)},f.prototype.resetPanelState_=function(e){for(var t=0;t<e.length;t++)e[t].classList.remove(this.CssClasses_.IS_ACTIVE)},f.prototype.toggleDrawer=function(){var e=this.element_.querySelector("."+this.CssClasses_.DRAWER_BTN);this.drawer_.classList.toggle(this.CssClasses_.IS_DRAWER_OPEN),this.obfuscator_.classList.toggle(this.CssClasses_.IS_DRAWER_OPEN),this.drawer_.classList.contains(this.CssClasses_.IS_DRAWER_OPEN)?(this.drawer_.setAttribute("aria-hidden","false"),e.setAttribute("aria-expanded","true")):(this.drawer_.setAttribute("aria-hidden","true"),e.setAttribute("aria-expanded","false"))},f.prototype.toggleDrawer=f.prototype.toggleDrawer,f.prototype.init=function(){if(this.element_){var e=document.createElement("div");e.classList.add(this.CssClasses_.CONTAINER);var s=this.element_.querySelector(":focus");this.element_.parentElement.insertBefore(e,this.element_),this.element_.parentElement.removeChild(this.element_),e.appendChild(this.element_),s&&s.focus();for(var i=this.element_.childNodes,n=i.length,a=0;a<n;a++){var l=i[a];l.classList&&l.classList.contains(this.CssClasses_.HEADER)&&(this.header_=l),l.classList&&l.classList.contains(this.CssClasses_.DRAWER)&&(this.drawer_=l),l.classList&&l.classList.contains(this.CssClasses_.CONTENT)&&(this.content_=l)}window.addEventListener("pageshow",function(e){e.persisted&&(this.element_.style.overflowY="hidden",requestAnimationFrame(function(){this.element_.style.overflowY=""}.bind(this)))}.bind(this),!1),this.header_&&(this.tabBar_=this.header_.querySelector("."+this.CssClasses_.TAB_BAR));var o=this.Mode_.STANDARD;if(this.header_&&(this.header_.classList.contains(this.CssClasses_.HEADER_SEAMED)?o=this.Mode_.SEAMED:this.header_.classList.contains(this.CssClasses_.HEADER_WATERFALL)?(o=this.Mode_.WATERFALL,this.header_.addEventListener("transitionend",this.headerTransitionEndHandler_.bind(this)),this.header_.addEventListener("click",this.headerClickHandler_.bind(this))):this.header_.classList.contains(this.CssClasses_.HEADER_SCROLL)&&(o=this.Mode_.SCROLL,e.classList.add(this.CssClasses_.HAS_SCROLLING_HEADER)),o===this.Mode_.STANDARD?(this.header_.classList.add(this.CssClasses_.CASTING_SHADOW),this.tabBar_&&this.tabBar_.classList.add(this.CssClasses_.CASTING_SHADOW)):o===this.Mode_.SEAMED||o===this.Mode_.SCROLL?(this.header_.classList.remove(this.CssClasses_.CASTING_SHADOW),this.tabBar_&&this.tabBar_.classList.remove(this.CssClasses_.CASTING_SHADOW)):o===this.Mode_.WATERFALL&&(this.content_.addEventListener("scroll",this.contentScrollHandler_.bind(this)),this.contentScrollHandler_())),this.drawer_){var r=this.element_.querySelector("."+this.CssClasses_.DRAWER_BTN);if(!r){r=document.createElement("div"),r.setAttribute("aria-expanded","false"),r.setAttribute("role","button"),r.setAttribute("tabindex","0"),r.classList.add(this.CssClasses_.DRAWER_BTN);var _=document.createElement("i");_.classList.add(this.CssClasses_.ICON),_.innerHTML=this.Constant_.MENU_ICON,r.appendChild(_)}this.drawer_.classList.contains(this.CssClasses_.ON_LARGE_SCREEN)?r.classList.add(this.CssClasses_.ON_LARGE_SCREEN):this.drawer_.classList.contains(this.CssClasses_.ON_SMALL_SCREEN)&&r.classList.add(this.CssClasses_.ON_SMALL_SCREEN),r.addEventListener("click",this.drawerToggleHandler_.bind(this)),r.addEventListener("keydown",this.drawerToggleHandler_.bind(this)),this.element_.classList.add(this.CssClasses_.HAS_DRAWER),this.element_.classList.contains(this.CssClasses_.FIXED_HEADER)?this.header_.insertBefore(r,this.header_.firstChild):this.element_.insertBefore(r,this.content_);var d=document.createElement("div");d.classList.add(this.CssClasses_.OBFUSCATOR),this.element_.appendChild(d),d.addEventListener("click",this.drawerToggleHandler_.bind(this)),this.obfuscator_=d,this.drawer_.addEventListener("keydown",this.keyboardEventHandler_.bind(this)),this.drawer_.setAttribute("aria-hidden","true")}if(this.screenSizeMediaQuery_=window.matchMedia(this.Constant_.MAX_WIDTH),this.screenSizeMediaQuery_.addListener(this.screenSizeHandler_.bind(this)),this.screenSizeHandler_(),this.header_&&this.tabBar_){this.element_.classList.add(this.CssClasses_.HAS_TABS);var h=document.createElement("div");h.classList.add(this.CssClasses_.TAB_CONTAINER),this.header_.insertBefore(h,this.tabBar_),this.header_.removeChild(this.tabBar_);var c=document.createElement("div");c.classList.add(this.CssClasses_.TAB_BAR_BUTTON),c.classList.add(this.CssClasses_.TAB_BAR_LEFT_BUTTON);var p=document.createElement("i");p.classList.add(this.CssClasses_.ICON),p.textContent=this.Constant_.CHEVRON_LEFT,c.appendChild(p),c.addEventListener("click",function(){this.tabBar_.scrollLeft-=this.Constant_.TAB_SCROLL_PIXELS}.bind(this));var C=document.createElement("div");C.classList.add(this.CssClasses_.TAB_BAR_BUTTON),C.classList.add(this.CssClasses_.TAB_BAR_RIGHT_BUTTON);var u=document.createElement("i");u.classList.add(this.CssClasses_.ICON),u.textContent=this.Constant_.CHEVRON_RIGHT,C.appendChild(u),C.addEventListener("click",function(){this.tabBar_.scrollLeft+=this.Constant_.TAB_SCROLL_PIXELS}.bind(this)),h.appendChild(c),h.appendChild(this.tabBar_),h.appendChild(C);var E=function(){this.tabBar_.scrollLeft>0?c.classList.add(this.CssClasses_.IS_ACTIVE):c.classList.remove(this.CssClasses_.IS_ACTIVE),this.tabBar_.scrollLeft<this.tabBar_.scrollWidth-this.tabBar_.offsetWidth?C.classList.add(this.CssClasses_.IS_ACTIVE):C.classList.remove(this.CssClasses_.IS_ACTIVE)}.bind(this);this.tabBar_.addEventListener("scroll",E),E();var m=function(){this.resizeTimeoutId_&&clearTimeout(this.resizeTimeoutId_),this.resizeTimeoutId_=setTimeout(function(){E(),this.resizeTimeoutId_=null}.bind(this),this.Constant_.RESIZE_TIMEOUT)}.bind(this);window.addEventListener("resize",m),this.tabBar_.classList.contains(this.CssClasses_.JS_RIPPLE_EFFECT)&&this.tabBar_.classList.add(this.CssClasses_.RIPPLE_IGNORE_EVENTS);for(var L=this.tabBar_.querySelectorAll("."+this.CssClasses_.TAB),I=this.content_.querySelectorAll("."+this.CssClasses_.PANEL),f=0;f<L.length;f++)new t(L[f],L,I,this)}this.element_.classList.add(this.CssClasses_.IS_UPGRADED)}},window.MaterialLayoutTab=t,s.register({constructor:f,classAsString:"MaterialLayout",cssClass:"mdl-js-layout"});var b=function(e){this.element_=e,this.init()};window.MaterialDataTable=b,b.prototype.Constant_={},b.prototype.CssClasses_={DATA_TABLE:"mdl-data-table",SELECTABLE:"mdl-data-table--selectable",SELECT_ELEMENT:"mdl-data-table__select",IS_SELECTED:"is-selected",IS_UPGRADED:"is-upgraded"},b.prototype.selectRow_=function(e,t,s){return t?function(){e.checked?t.classList.add(this.CssClasses_.IS_SELECTED):t.classList.remove(this.CssClasses_.IS_SELECTED)}.bind(this):s?function(){var t,i;if(e.checked)for(t=0;t<s.length;t++)i=s[t].querySelector("td").querySelector(".mdl-checkbox"),i.MaterialCheckbox.check(),s[t].classList.add(this.CssClasses_.IS_SELECTED);else for(t=0;t<s.length;t++)i=s[t].querySelector("td").querySelector(".mdl-checkbox"),i.MaterialCheckbox.uncheck(),s[t].classList.remove(this.CssClasses_.IS_SELECTED)}.bind(this):void 0},b.prototype.createCheckbox_=function(e,t){var i=document.createElement("label"),n=["mdl-checkbox","mdl-js-checkbox","mdl-js-ripple-effect",this.CssClasses_.SELECT_ELEMENT];i.className=n.join(" ");var a=document.createElement("input");return a.type="checkbox",a.classList.add("mdl-checkbox__input"),e?(a.checked=e.classList.contains(this.CssClasses_.IS_SELECTED),a.addEventListener("change",this.selectRow_(a,e))):t&&a.addEventListener("change",this.selectRow_(a,null,t)),i.appendChild(a),s.upgradeElement(i,"MaterialCheckbox"),i},b.prototype.init=function(){if(this.element_){var e=this.element_.querySelector("th"),t=Array.prototype.slice.call(this.element_.querySelectorAll("tbody tr")),s=Array.prototype.slice.call(this.element_.querySelectorAll("tfoot tr")),i=t.concat(s);if(this.element_.classList.contains(this.CssClasses_.SELECTABLE)){var n=document.createElement("th"),a=this.createCheckbox_(null,i);n.appendChild(a),e.parentElement.insertBefore(n,e);for(var l=0;l<i.length;l++){var o=i[l].querySelector("td");if(o){var r=document.createElement("td");if("TBODY"===i[l].parentNode.nodeName.toUpperCase()){var _=this.createCheckbox_(i[l]);r.appendChild(_)}i[l].insertBefore(r,o)}}this.element_.classList.add(this.CssClasses_.IS_UPGRADED)}}},s.register({constructor:b,classAsString:"MaterialDataTable",cssClass:"mdl-js-data-table"});var y=function(e){this.element_=e,this.init()};window.MaterialRipple=y,y.prototype.Constant_={INITIAL_SCALE:"scale(0.0001, 0.0001)",INITIAL_SIZE:"1px",INITIAL_OPACITY:"0.4",FINAL_OPACITY:"0",FINAL_SCALE:""},y.prototype.CssClasses_={RIPPLE_CENTER:"mdl-ripple--center",RIPPLE_EFFECT_IGNORE_EVENTS:"mdl-js-ripple-effect--ignore-events",RIPPLE:"mdl-ripple",IS_ANIMATING:"is-animating",IS_VISIBLE:"is-visible"},y.prototype.downHandler_=function(e){if(!this.rippleElement_.style.width&&!this.rippleElement_.style.height){var t=this.element_.getBoundingClientRect();this.boundHeight=t.height,this.boundWidth=t.width,this.rippleSize_=2*Math.sqrt(t.width*t.width+t.height*t.height)+2,this.rippleElement_.style.width=this.rippleSize_+"px",this.rippleElement_.style.height=this.rippleSize_+"px"}if(this.rippleElement_.classList.add(this.CssClasses_.IS_VISIBLE),"mousedown"===e.type&&this.ignoringMouseDown_)this.ignoringMouseDown_=!1;else{"touchstart"===e.type&&(this.ignoringMouseDown_=!0);var s=this.getFrameCount();if(s>0)return;this.setFrameCount(1);var i,n,a=e.currentTarget.getBoundingClientRect();if(0===e.clientX&&0===e.clientY)i=Math.round(a.width/2),n=Math.round(a.height/2);else{var l=void 0!==e.clientX?e.clientX:e.touches[0].clientX,o=void 0!==e.clientY?e.clientY:e.touches[0].clientY;i=Math.round(l-a.left),n=Math.round(o-a.top)}this.setRippleXY(i,n),this.setRippleStyles(!0),window.requestAnimationFrame(this.animFrameHandler.bind(this))}},y.prototype.upHandler_=function(e){e&&2!==e.detail&&window.setTimeout(function(){this.rippleElement_.classList.remove(this.CssClasses_.IS_VISIBLE)}.bind(this),0)},y.prototype.init=function(){if(this.element_){var e=this.element_.classList.contains(this.CssClasses_.RIPPLE_CENTER);this.element_.classList.contains(this.CssClasses_.RIPPLE_EFFECT_IGNORE_EVENTS)||(this.rippleElement_=this.element_.querySelector("."+this.CssClasses_.RIPPLE),this.frameCount_=0,this.rippleSize_=0,this.x_=0,this.y_=0,this.ignoringMouseDown_=!1,this.boundDownHandler=this.downHandler_.bind(this),this.element_.addEventListener("mousedown",this.boundDownHandler),this.element_.addEventListener("touchstart",this.boundDownHandler),this.boundUpHandler=this.upHandler_.bind(this),this.element_.addEventListener("mouseup",this.boundUpHandler),this.element_.addEventListener("mouseleave",this.boundUpHandler),this.element_.addEventListener("touchend",this.boundUpHandler),this.element_.addEventListener("blur",this.boundUpHandler),this.getFrameCount=function(){return this.frameCount_},this.setFrameCount=function(e){this.frameCount_=e},this.getRippleElement=function(){return this.rippleElement_},this.setRippleXY=function(e,t){this.x_=e,this.y_=t},this.setRippleStyles=function(t){if(null!==this.rippleElement_){var s,i,n,a="translate("+this.x_+"px, "+this.y_+"px)";t?(i=this.Constant_.INITIAL_SCALE,n=this.Constant_.INITIAL_SIZE):(i=this.Constant_.FINAL_SCALE,n=this.rippleSize_+"px",e&&(a="translate("+this.boundWidth/2+"px, "+this.boundHeight/2+"px)")),s="translate(-50%, -50%) "+a+i,this.rippleElement_.style.webkitTransform=s,this.rippleElement_.style.msTransform=s,this.rippleElement_.style.transform=s,t?this.rippleElement_.classList.remove(this.CssClasses_.IS_ANIMATING):this.rippleElement_.classList.add(this.CssClasses_.IS_ANIMATING)}},this.animFrameHandler=function(){this.frameCount_-- >0?window.requestAnimationFrame(this.animFrameHandler.bind(this)):this.setRippleStyles(!1)})}},s.register({constructor:y,classAsString:"MaterialRipple",cssClass:"mdl-js-ripple-effect",widget:!1})}();
//# sourceMappingURL=material.min.js.map

'use strict';

// TODO(alockwood): fix this hack...
if (document.getElementById("playTransformScaleCheckbox") !== null) {
var bezierEasing = require('bezier-easing');
var webAnimationsJs = require('web-animations-js');
var pathDataPolyfill = require('path-data-polyfill');

// =======================================================================================
// =======================================================================================
// =======================================================================================
// =============== DEMO: transforming play, pause, and record icons (interactive)
// =======================================================================================
// =======================================================================================
// =======================================================================================

document.addEventListener("DOMContentLoaded", function () {
  function getCheckbox(checkboxId) {
    return document.querySelector("input[id=" + checkboxId + "]");
  }

  function updateGroupTransform(iconType, transformType, shouldEnable) {
    var group = document.getElementById("transform_paths_" + iconType + "_" + transformType);
    var currentTransformValue;
    var nextTransformValue;
    if (transformType === "translation") {
      currentTransformValue = shouldEnable ? "translate(0px,0px)" : "translate(40px,0px)";
      nextTransformValue = shouldEnable ? "translate(40px,0px)" : "translate(0px,0px)";
    } else if (transformType === "scale") {
      currentTransformValue = shouldEnable ? "scale(1,1)" : "scale(1.5,1)";
      nextTransformValue = shouldEnable ? "scale(1.5,1)" : "scale(1,1)";
    } else {
      currentTransformValue = shouldEnable ? "rotate(0deg)" : "rotate(90deg)";
      nextTransformValue = shouldEnable ? "rotate(90deg)" : "rotate(0deg)";
    }
    group.animate([
      { transform: currentTransformValue, offset: 0, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      { transform: nextTransformValue, offset: 1 }
    ], { duration: 300, fill: "forwards" });
  }

  var playScale = getCheckbox("playTransformScaleCheckbox");
  var playRotation = getCheckbox("playTransformRotationCheckbox");
  var playTranslation = getCheckbox("playTransformTranslationCheckbox");
  var pauseScale = getCheckbox("pauseTransformScaleCheckbox");
  var pauseRotation = getCheckbox("pauseTransformRotationCheckbox");
  var pauseTranslation = getCheckbox("pauseTransformTranslationCheckbox");
  var recordScale = getCheckbox("recordTransformScaleCheckbox");
  var recordRotation = getCheckbox("recordTransformRotationCheckbox");
  var recordTranslation = getCheckbox("recordTransformTranslationCheckbox");

  playScale.addEventListener("change", function () {
    updateGroupTransform("play", "scale", playScale.checked);
  });
  playRotation.addEventListener("change", function () {
    updateGroupTransform("play", "rotation", playRotation.checked);
  });
  playTranslation.addEventListener("change", function () {
    updateGroupTransform("play", "translation", playTranslation.checked);
  });
  pauseScale.addEventListener("change", function () {
    updateGroupTransform("pause", "scale", pauseScale.checked);
  });
  pauseRotation.addEventListener("change", function () {
    updateGroupTransform("pause", "rotation", pauseRotation.checked);
  });
  pauseTranslation.addEventListener("change", function () {
    updateGroupTransform("pause", "translation", pauseTranslation.checked);
  });
  recordScale.addEventListener("change", function () {
    updateGroupTransform("record", "scale", recordScale.checked);
  });
  recordRotation.addEventListener("change", function () {
    updateGroupTransform("record", "rotation", recordRotation.checked);
  });
  recordTranslation.addEventListener("change", function () {
    updateGroupTransform("record", "translation", recordTranslation.checked);
  });
});

// =======================================================================================
// =======================================================================================
// =======================================================================================
// =============== DEMO: transforming groups of paths (chevron, alarm clock, radio button)
// =======================================================================================
// =======================================================================================
// =======================================================================================

document.addEventListener("DOMContentLoaded", function () {
  var fastOutSlowIn = "cubic-bezier(0.4, 0, 0.2, 1.0)";

  function getScaledAnimationDuration(durationMillis) {
    var slowAnimationSelector = document.querySelector("input[id=basicTransformationSlowAnimationCheckbox]");
    var currentAnimationDurationFactor = slowAnimationSelector.checked ? 10 : 1;
    return durationMillis * currentAnimationDurationFactor;
  }

  document.querySelector("input[id=basicTransformationHighlightAnimatingPathsCheckbox]").addEventListener("change", function () {
    var shouldHighlight = document.querySelector("input[id=basicTransformationHighlightAnimatingPathsCheckbox]").checked;
    var visibility = shouldHighlight ? "visible" : "hidden";
    var highlightPaths = document.getElementsByClassName("delightIconHighlightPath");
    var i = 0;
    for (i = 0; i < highlightPaths.length; i += 1) {
      highlightPaths.item(i).style.visibility = visibility;
    }
  });

  function animateTransform(elementId, durationMillis, transformType, fromValue, toValue, easingFunction) {
    document.getElementById(elementId).animate([
      { transform: transformType + "(" + fromValue + ")", offset: 0, easing: easingFunction },
      { transform: transformType + "(" + toValue + ")", offset: 1 }
    ], { duration: getScaledAnimationDuration(durationMillis), fill: "forwards" });
  }

  // =============== Chevron icon.
  var isExpanded = false;
  document.getElementById("ic_expand_collapse").addEventListener("click", function () {
    if (isExpanded) {
      animateTransform("chevron", 250, "translate", "12px,9px", "12px,15px", fastOutSlowIn);
      animateTransform("leftBar", 200, "rotate", "45deg", "135deg", "cubic-bezier(0, 0, 0, 1)");
      animateTransform("rightBar", 200, "rotate", "135deg", "45deg", "cubic-bezier(0, 0, 0, 1)");
    } else {
      animateTransform("chevron", 250, "translate", "12px,15px", "12px,9px", fastOutSlowIn);
      animateTransform("leftBar", 200, "rotate", "135deg", "45deg", "cubic-bezier(0, 0, 0, 1)");
      animateTransform("rightBar", 200, "rotate", "45deg", "135deg", "cubic-bezier(0, 0, 0, 1)");
    }
    isExpanded = !isExpanded;
  });

  // =============== Radio button icon.
  var isRadioButtonChecked = false;
  document.getElementById("ic_radiobutton").addEventListener("click", function () {
    animateRadioButton(!isRadioButtonChecked);
    isRadioButtonChecked = !isRadioButtonChecked;
  });

  function animateRadioButton(isAnimatingToCheck) {
    document.getElementById("radiobutton_ring_group").animate([{
      transform: "scale(1,1)",
      offset: 0,
      easing: fastOutSlowIn
    }, {
      transform: isAnimatingToCheck ? "scale(0.5,0.5)" : "scale(0.9,0.9)",
      offset: isAnimatingToCheck ? 0.333 : 0.4,
      easing: isAnimatingToCheck ? fastOutSlowIn : "cubic-bezier(0.4, 0, 0.4, 1.0)"
    }, {
      transform: isAnimatingToCheck ? "scale(0.9,0.9)" : "scale(0.5,0.5)",
      offset: isAnimatingToCheck ? 0.333 : 0.4,
      easing: isAnimatingToCheck ? fastOutSlowIn : "cubic-bezier(0.4, 0, 0.4, 1.0)"
    }, {
      transform: "scale(1,1)",
      offset: 1
    }], {
      duration: getScaledAnimationDuration(500),
      fill: "forwards"
    });
    document.getElementById("radiobutton_ring_path").animate([{
      strokeWidth: "2",
      offset: 0,
      easing: isAnimatingToCheck ? "cubic-bezier(0.4, 0, 0.4, 1.0)" : fastOutSlowIn
    }, {
      strokeWidth: isAnimatingToCheck ? "18" : "2",
      offset: isAnimatingToCheck ? 0.333 : 0.4,
      easing: fastOutSlowIn
    }, {
      strokeWidth: isAnimatingToCheck ? "2" : "18",
      offset: isAnimatingToCheck ? 0.333 : 0.4,
      easing: fastOutSlowIn
    }, {
      strokeWidth: "2",
      offset: 1
    }], {
      duration: getScaledAnimationDuration(500),
      fill: "forwards"
    });
    document.getElementById("radiobutton_dot_group").animate([{
      transform: isAnimatingToCheck ? "scale(0,0)" : "scale(1,1)",
      offset: 0,
      easing: fastOutSlowIn
    }, {
      transform: isAnimatingToCheck ? "scale(0,0)" : "scale(1.5,1.5)",
      offset: isAnimatingToCheck ? 0.333 : 0.4,
      easing: fastOutSlowIn
    }, {
      transform: isAnimatingToCheck ? "scale(1.5,1.5)" : "scale(0,0)",
      offset: isAnimatingToCheck ? 0.333 : 0.4,
      easing: fastOutSlowIn
    }, {
      transform: isAnimatingToCheck ? "scale(1,1)" : "scale(0,0)",
      offset: 1
    }], {
      duration: getScaledAnimationDuration(500),
      fill: "forwards"
    });
  }

  // =============== Alarm clock icon.
  document.getElementById("ic_alarm").addEventListener("click", function () {
    animateAlarmClock();
  });

  function createKeyFrame(rotationDegrees, keyFrameOffset) {
    return {
      transform: "rotate(" + rotationDegrees + "deg)",
      offset: keyFrameOffset,
      easing: fastOutSlowIn
    };
  }

  function animateAlarmClock() {
    var keyFrames = [];
    var i = 0;
    for (i = 0; i < 22; i += 1) {
      if (i === 0) {
        keyFrames.push(createKeyFrame(0, 0));
      } else if (i < 21) {
        var rotation = i % 2 === 0 ? -8 : 8;
        keyFrames.push(createKeyFrame(rotation, 0.025 + ((i - 1) * 0.05)));
      } else {
        keyFrames.push({
          transform: "rotate(0deg)",
          offset: 1.0
        });
      }
    }
    document.getElementById("alarmclock_button_rotation").animate(keyFrames, {
      duration: getScaledAnimationDuration(1333),
      fill: "forwards"
    });
  }
});

// =======================================================================================
// =======================================================================================
// =======================================================================================
// =============== DEMO: transforming groups of paths, linear indeterminate progress bar
// =======================================================================================
// =======================================================================================
// =======================================================================================

document.addEventListener("DOMContentLoaded", function () {

  function createOuterRect1Animation() {
    return document.getElementById('progressBarOuterRect1').animate([
      { transform: 'translateX(-522.59998px)', offset: 0, easing: 'linear' },
      { transform: 'translateX(-522.59998px)', offset: 0.2, easing: 'cubic-bezier(0.5, 0, 0.701732, 0.495818703)' },
      { transform: 'translateX(-185.382686832px)', offset: 0.5915, easing: 'cubic-bezier(0.302435, 0.38135197, 0.55, 0.956352125)' },
      { transform: 'translateX(235.600006104px)', offset: 1 }
    ], { duration: 2000, iterations: Infinity });
  }

  function createInnerRect1Animation() {
    return document.getElementById('progressBarInnerRect1').animate([
      { transform: 'scaleX(0.1)', offset: 0, easing: 'linear' },
      { transform: 'scaleX(0.1)', offset: 0.3665, easing: 'cubic-bezier(0.334731432, 0.124819821, 0.785843996, 1)' },
      { transform: 'scaleX(0.826849212646)', offset: 0.6915, easing: 'cubic-bezier(0.225732004, 0, 0.233648906, 1.3709798)' },
      { transform: 'scaleX(0.1)', offset: 1 }
    ], { duration: 2000, iterations: Infinity });
  }

  function createOuterRect2Animation() {
    return document.getElementById('progressBarOuterRect2').animate([{
      transform: 'translateX(-161.600006104px)',
      offset: 0,
      easing: 'cubic-bezier(0.15, 0, 0.5150584, 0.409684966)'
    }, {
      transform: 'translateX(-26.0531211724px)',
      offset: 0.25,
      easing: 'cubic-bezier(0.3103299, 0.284057684, 0.8, 0.733718979)'
    }, {
      transform: 'translateX(142.190187566px)',
      offset: 0.4835,
      easing: 'cubic-bezier(0.4, 0.627034903, 0.6, 0.902025796)'
    }, {
      transform: 'translateX(458.600006104px)',
      offset: 1
    }], {
      duration: 2000,
      iterations: Infinity
    });
  }

  function createInnerRect2Animation() {
    return document.getElementById('progressBarInnerRect2').animate([
      { transform: 'scaleX(0.1)', offset: 0, easing: 'cubic-bezier(0.205028172, 0.057050836, 0.57660995, 0.453970841)' },
      { transform: 'scaleX(0.571379510698)', offset: 0.1915, easing: 'cubic-bezier(0.152312994, 0.196431957, 0.648373778, 1.00431535)' },
      { transform: 'scaleX(0.909950256348)', offset: 0.4415, easing: 'cubic-bezier(0.25775882, -0.003163357, 0.211761916, 1.38178961)' },
      { transform: 'scaleX(0.1)', offset: 1 }
    ], { duration: 2000, iterations: Infinity });
  }

  var outerRect1Animation = createOuterRect1Animation();
  var innerRect1Animation = createInnerRect1Animation();
  var outerRect2Animation = createOuterRect2Animation();
  var innerRect2Animation = createInnerRect2Animation();

  var scaleSelector = document.querySelector("input[id=linearProgressScaleCheckbox]");
  var translateSelector = document.querySelector("input[id=linearProgressTranslateCheckbox]");

  function restartAnimations() {
    outerRect1Animation.cancel();
    innerRect1Animation.cancel();
    outerRect2Animation.cancel();
    innerRect2Animation.cancel();
    outerRect1Animation = createOuterRect1Animation();
    innerRect1Animation = createInnerRect1Animation();
    outerRect2Animation = createOuterRect2Animation();
    innerRect2Animation = createInnerRect2Animation();
    if (!scaleSelector.checked) {
      innerRect1Animation.cancel();
      innerRect2Animation.cancel();
    }
    if (!translateSelector.checked) {
      outerRect1Animation.cancel();
      outerRect2Animation.cancel();
    }
  }

  scaleSelector.addEventListener("change", function () {
    restartAnimations();
  });
  translateSelector.addEventListener("change", function () {
    restartAnimations();
  });
});

// =======================================================================================
// =======================================================================================
// =======================================================================================
// =============== DEMO: trimming stroked paths, interactive demo
// =======================================================================================
// =======================================================================================
// =======================================================================================

document.addEventListener("DOMContentLoaded", function () {
  var trimPathStart = 0.0;
  var trimPathEnd = 0.5;
  var trimPathOffset = 0.0;

  function updateSliderText() {
    document.getElementById("trimPathStartValue").innerHTML = trimPathStart;
    document.getElementById("trimPathEndValue").innerHTML = trimPathEnd;
    document.getElementById("trimPathOffsetValue").innerHTML = trimPathOffset;
  }

  function convertCurrentTrimToDashArray(pathLength) {
    // Calculate the normalized length of the trimmed path. If trimPathStart
    // is greater than trimPathEnd, then the result should be the combined
    // length of the two line segments: [trimPathStart,1] and [0,trimPathEnd].
    var trimPathLengthNormalized = trimPathEnd - trimPathStart;
    if (trimPathStart > trimPathEnd) {
      trimPathLengthNormalized += 1;
    }

    // Calculate the absolute length of the trim path by multiplying the
    // normalized length with the actual length of the path.
    var trimPathLength = trimPathLengthNormalized * pathLength;

    // Return the dash array. The first array element is the length of
    // the trimmed path and the second element is the gap, which is the
    // difference in length between the total path length and the trimmed
    // path length.
    return trimPathLength + "," + (pathLength - trimPathLength);
  }

  function convertCurrentTrimToDashOffset(pathLength) {
    // The amount to offset the path is equal to the trimPathStart plus
    // trimPathOffset. We mod the result because the trimmed path
    // should wrap around once it reaches 1.
    var trueTrimPathStart = (trimPathStart + trimPathOffset) % 1;

    // Return the dash offset.
    return pathLength * (1 - trueTrimPathStart);
  }

  function updateStrokePath() {
    var linePath = document.getElementById("line_path");
    var linePathLength = linePath.getTotalLength();
    var lineDashArray = convertCurrentTrimToDashArray(linePathLength);
    var lineDashOffset = convertCurrentTrimToDashOffset(linePathLength);
    linePath.setAttribute("stroke-dasharray", lineDashArray);
    linePath.setAttribute("stroke-dashoffset", lineDashOffset);
  }

  function updateUi() {
    updateStrokePath();
    updateSliderText();
  }

  document.querySelector("input[id=trimPathStart]").addEventListener("change", function () {
    trimPathStart = document.querySelector("input[id=trimPathStart]").value / 100;
    updateUi();
  });
  document.querySelector("input[id=trimPathEnd]").addEventListener("change", function () {
    trimPathEnd = document.querySelector("input[id=trimPathEnd]").value / 100;
    updateUi();
  });
  document.querySelector("input[id=trimPathOffset]").addEventListener("change", function () {
    trimPathOffset = document.querySelector("input[id=trimPathOffset]").value / 100;
    updateUi();
  });
  document.querySelector("input[id=trimPathStart]").addEventListener("input", function () {
    trimPathStart = document.querySelector("input[id=trimPathStart]").value / 100;
    updateUi();
  });
  document.querySelector("input[id=trimPathEnd]").addEventListener("input", function () {
    trimPathEnd = document.querySelector("input[id=trimPathEnd]").value / 100;
    updateUi();
  });
  document.querySelector("input[id=trimPathOffset]").addEventListener("input", function () {
    trimPathOffset = document.querySelector("input[id=trimPathOffset]").value / 100;
    updateUi();
  });
});

// =======================================================================================
// =======================================================================================
// =======================================================================================
// =============== DEMO: trimming stroked paths (fingerprint, search to back, etc.)
// =======================================================================================
// =======================================================================================
// =======================================================================================

document.addEventListener("DOMContentLoaded", function () {
  var root = document.getElementById("includes6");
  var fastOutSlowIn = common.fastOutSlowIn;
  var fastOutLinearIn = common.fastOutLinearIn;
  var linearOutSlowIn = common.linearOutSlowIn;

  function animateTrimPathStartWithDelay(strokePathId, durationMillis, startDelayMillis, easingFunction, isAnimatingIn) {
    var strokePath = document.getElementById(strokePathId);
    var pathLength = strokePath.getTotalLength();
    // TODO(alockwood): remove this hack...
    strokePath.animate([
      { strokeDasharray: pathLength, strokeDashoffset: (isAnimatingIn ? -pathLength : 0), offset: 0 },
      { strokeDasharray: pathLength, strokeDashoffset: (isAnimatingIn ? -pathLength : 0), offset: 1 }
    ], { duration: 0, fill: "forwards" });
    strokePath.animate([
      { strokeDasharray: pathLength, strokeDashoffset: (isAnimatingIn ? -pathLength : 0), easing: easingFunction, offset: 0 },
      { strokeDasharray: pathLength, strokeDashoffset: (isAnimatingIn ? 0 : -pathLength), offset: 1 }
    ], { duration: common.getDuration(root, durationMillis), fill: "forwards", delay: common.getDuration(root, startDelayMillis) });
  }

  function animateTrimPathEndWithDelay(strokePathId, durationMillis, startDelayMillis, easingFunction, isAnimatingIn) {
    var strokePath = document.getElementById(strokePathId);
    var pathLength = strokePath.getTotalLength();
    // TODO(alockwood): remove this hack...
    strokePath.animate([
      { strokeDasharray: pathLength, strokeDashoffset: (isAnimatingIn ? pathLength : 0), offset: 0 },
      { strokeDasharray: pathLength, strokeDashoffset: (isAnimatingIn ? pathLength : 0), offset: 1 }
    ], { duration: 0, fill: "forwards" });
    strokePath.animate([
      { strokeDasharray: pathLength, strokeDashoffset: (isAnimatingIn ? pathLength : 0), easing: easingFunction, offset: 0 },
      { strokeDasharray: pathLength, strokeDashoffset: (isAnimatingIn ? 0 : pathLength), offset: 1 }
    ], { duration: common.getDuration(root, durationMillis), fill: "forwards", delay: common.getDuration(root, startDelayMillis) });
  }

  document.querySelector(root.nodeName + "#" + root.id + " input[id=includes6_showTrimPathsCheckbox]").addEventListener("change", function () {
    var visibility = document.querySelector(root.nodeName + "#" + root.id + " input[id=includes6_showTrimPathsCheckbox]").checked ? "visible" : "hidden";
    var fingerprintDebugPaths = document.getElementsByClassName("delightIconFingerPrintStrokePathDebug");
    var i = 0;
    for (i = 0; i < fingerprintDebugPaths.length; i += 1) {
      fingerprintDebugPaths.item(i).style.visibility = visibility;
    }
    var handwritingDebugPaths = document.getElementsByClassName("delightIconHandwritingStrokePathDebug");
    for (i = 0; i < handwritingDebugPaths.length; i += 1) {
      handwritingDebugPaths.item(i).style.visibility = visibility;
    }
    var searchToBackDebugPaths = document.getElementsByClassName("delightIconSearchToBackStrokePathDebug");
    for (i = 0; i < searchToBackDebugPaths.length; i += 1) {
      searchToBackDebugPaths.item(i).style.visibility = visibility;
    }
  });

  // =============== Search to back animation.
  var isBackArrow = false;
  document.getElementById("ic_search_back").addEventListener("click", function () {
    animateArrowHead(!isBackArrow);
    animateSearchCircle(isBackArrow);
    animateStem(!isBackArrow);
    isBackArrow = !isBackArrow;
  });

  function animateStem(isAnimatingToBack) {
    var fastOutSlowInFunction = bezierEasing(0.4, 0, 0.2, 1);
    var stemPath = document.getElementById("stem");
    var pathLength = stemPath.getTotalLength();
    var keyFrames = [];
    var i;
    var trimPathStart;
    var trimPathEnd;
    var trimPathLength;
    if (isAnimatingToBack) {
      for (i = 0; i < 600; i += 16) {
        trimPathStart = fastOutSlowInFunction(i / 600) * 0.75;
        trimPathEnd = fastOutSlowInFunction(Math.min(i, 450) / 450) * (1 - 0.185) + 0.185;
        trimPathLength = trimPathEnd - trimPathStart;
        keyFrames.push({
          strokeDasharray: (trimPathLength * pathLength) + "," + pathLength,
          strokeDashoffset: (-trimPathStart * pathLength),
          easing: "linear",
          offset: (i / 600)
        });
      }
      keyFrames.push({
        strokeDasharray: (0.25 * pathLength) + "," + pathLength,
        strokeDashoffset: (-0.75 * pathLength),
        offset: 1
      });
      return stemPath.animate(keyFrames, {
        duration: common.getDuration(root, 600),
        fill: "forwards"
      });
    } else {
      for (i = 0; i < 600; i += 16) {
        trimPathStart = (1 - fastOutSlowInFunction(Math.min(i, 450) / 450)) * 0.75;
        trimPathEnd = 1 - fastOutSlowInFunction(i / 600) * 0.815;
        trimPathLength = trimPathEnd - trimPathStart;
        keyFrames.push({
          strokeDasharray: (trimPathLength * pathLength) + "," + pathLength,
          strokeDashoffset: (-trimPathStart * pathLength),
          easing: "linear",
          offset: (i / 600)
        });
      }
      keyFrames.push({
        strokeDasharray: (0.185 * pathLength) + "," + pathLength,
        strokeDashoffset: 0,
        offset: 1
      });
      return stemPath.animate(keyFrames, {
        duration: common.getDuration(root, 600),
        fill: "forwards"
      });
    }
  }

  function animateSearchCircle(isAnimatingIn) {
    var searchCirclePath = document.getElementById("search_circle");
    var pathLength = searchCirclePath.getTotalLength();
    searchCirclePath.animate([{
      strokeDasharray: pathLength,
      strokeDashoffset: (isAnimatingIn ? pathLength : 0),
      easing: fastOutSlowIn,
      offset: 0
    }, {
      strokeDasharray: pathLength,
      strokeDashoffset: (isAnimatingIn ? 0 : pathLength),
      offset: 1
    }], {
      duration: common.getDuration(root, 250),
      fill: "forwards",
      delay: common.getDuration(root, isAnimatingIn ? 300 : 0)
    });
  }

  function animateArrowHead(isAnimatingIn) {
    var arrowHeadGroup = document.getElementById("arrow_head");
    var arrowHeadTop = document.getElementById("arrow_head_top");
    var arrowHeadBottom = document.getElementById("arrow_head_bottom");
    var arrowHeadTopPathLength = arrowHeadTop.getTotalLength();
    var arrowHeadBottomPathLength = arrowHeadBottom.getTotalLength();
    arrowHeadGroup.animate([{
      transform: (isAnimatingIn ? "translate(8px,0px)" : "translate(0px,0px)"),
      easing: (isAnimatingIn ? linearOutSlowIn : fastOutLinearIn),
      offset: 0
    }, {
      transform: (isAnimatingIn ? "translate(0px,0px)" : "translate(24px,0px)"),
      offset: 1
    }], {
      duration: common.getDuration(root, 250),
      fill: "forwards",
      delay: common.getDuration(root, isAnimatingIn ? 350 : 0)
    });
    arrowHeadTop.animate([{
      strokeDasharray: arrowHeadTopPathLength,
      strokeDashoffset: (isAnimatingIn ? arrowHeadTopPathLength : 0),
      easing: fastOutSlowIn,
      offset: 0
    }, {
      strokeDasharray: arrowHeadTopPathLength,
      strokeDashoffset: (isAnimatingIn ? 0 : arrowHeadTopPathLength),
      offset: 1
    }], {
      duration: common.getDuration(root, 250),
      fill: "forwards",
      delay: common.getDuration(root, isAnimatingIn ? 350 : 0)
    });
    arrowHeadBottom.animate([{
      strokeDasharray: arrowHeadBottomPathLength,
      strokeDashoffset: (isAnimatingIn ? arrowHeadBottomPathLength : 0),
      easing: fastOutSlowIn,
      offset: 0
    }, {
      strokeDasharray: arrowHeadBottomPathLength,
      strokeDashoffset: (isAnimatingIn ? 0 : arrowHeadBottomPathLength),
      offset: 1
    }], {
      duration: common.getDuration(root, 250),
      fill: "forwards",
      delay: common.getDuration(root, isAnimatingIn ? 350 : 0)
    });
  }

  // =============== Handwriting animation.
  var currentHandwritingAnimations = [];
  document.getElementById("ic_android_handwriting").addEventListener("click", function () {
    for (var i = 0; i < currentHandwritingAnimations.length; i++) {
      currentHandwritingAnimations[i].cancel();
    }
    currentHandwritingAnimations = [];
    resetAllStrokes();
    animateHandwritingStroke("andro", 1000, 0, fastOutLinearIn);
    animateHandwritingStroke("id", 250, 1050, fastOutSlowIn);
    animateHandwritingStroke("a", 50, 1300, fastOutSlowIn);
    animateHandwritingStroke("i1_dot", 50, 1400, fastOutSlowIn);
  });

  function resetAllStrokes() {
    var ids = ["andro", "id", "a", "i1_dot"];
    for (var i = 0; i < ids.length; i++) {
      var path = document.getElementById(ids[i]);
      var pathLength = path.getTotalLength();
      // TODO(alockwood): fix this hack
      currentHandwritingAnimations.push(path.animate([
        { strokeDasharray: pathLength, strokeDashoffset: pathLength, offset: 0, },
        { strokeDasharray: pathLength, strokeDashoffset: pathLength, offset: 1 }
      ], { duration: 0, fill: "forwards" }));
    }
  }

  function animateHandwritingStroke(pathId, durationMillis, startDelayMillis, easingCurve) {
    var path = document.getElementById(pathId);
    var pathLength = path.getTotalLength();
    path.animate([{
      strokeDasharray: pathLength,
      strokeDashoffset: pathLength,
      easing: easingCurve,
      offset: 0,
    }, {
      strokeDasharray: pathLength,
      strokeDashoffset: 0,
      offset: 1
    }], {
      duration: common.getDuration(root, durationMillis),
      fill: "forwards",
      delay: common.getDuration(root, startDelayMillis)
    });
  }

  // =============== Fingerprint animation.
  var isFingerprintVisible = true;
  document.getElementById("ic_fingerprint").addEventListener("click", function () {
    animateFingerprint(!isFingerprintVisible);
    isFingerprintVisible = !isFingerprintVisible;
  });

  function animateFingerprint(isAnimatingIn) {
    if (isAnimatingIn) {
      animateTrimPathStartWithDelay("ridge_5_path", 180, 20, "cubic-bezier(0.5, 0.5, 1, 1)", true);
      animateTrimPathStartWithDelay("ridge_7_path", 160, 10, "cubic-bezier(0.5, 0.5, 1, 1)", true);
      animateTrimPathEndWithDelay("ridge_6_path", 190, 0, "cubic-bezier(0.5, 0.5, 1, 1)", true);
      animateTrimPathEndWithDelay("ridge_2_path", 140, 0, "cubic-bezier(0.5, 0, 1, 1)", true);
      animateTrimPathStartWithDelay("ridge_1_path", 216, 60, "cubic-bezier(0.5, 0.5, 1, 1)", true);
    } else {
      animateTrimPathEndWithDelay("ridge_5_path", 383, 33, "cubic-bezier(0, 0.29, 1, 1)", false);
      animateTrimPathEndWithDelay("ridge_7_path", 483, 83, "cubic-bezier(0, 0.5, 1, 1)", false);
      animateTrimPathStartWithDelay("ridge_6_path", 549, 50, "cubic-bezier(0, 0.5, 1, 1)", false);
      animateTrimPathStartWithDelay("ridge_2_path", 400, 216, "cubic-bezier(0, 0.5, 1, 1)", false);
      animateTrimPathEndWithDelay("ridge_1_path", 383, 316, "cubic-bezier(0, 0.5, 1, 1)", false);
    }
  }

  // =============== Google IO 2016 animation.
  var currentIo16Animations = [];
  var ioOne1 = document.getElementById("io16_one_1");
  var ioOne2 = document.getElementById("io16_one_2");
  var ioOne3 = document.getElementById("io16_one_3");
  var ioOne4 = document.getElementById("io16_one_4");
  var ioSix1 = document.getElementById("io16_six_1");
  var ioSix2 = document.getElementById("io16_six_2");
  var ioSix3 = document.getElementById("io16_six_3");
  var ioSix4 = document.getElementById("io16_six_4");
  var onePathLength = ioOne1.getTotalLength();
  var sixPathLength = ioSix1.getTotalLength();
  var oneStrokeDashArray = (onePathLength / 4) + "," + (onePathLength * 3 / 4);
  var sixStrokeDashArray = (sixPathLength / 4) + "," + (sixPathLength * 3 / 4);
  ioOne1.setAttribute("stroke-dasharray", oneStrokeDashArray);
  ioOne2.setAttribute("stroke-dasharray", oneStrokeDashArray);
  ioOne3.setAttribute("stroke-dasharray", oneStrokeDashArray);
  ioOne4.setAttribute("stroke-dasharray", oneStrokeDashArray);
  ioSix1.setAttribute("stroke-dasharray", sixStrokeDashArray);
  ioSix2.setAttribute("stroke-dasharray", sixStrokeDashArray);
  ioSix3.setAttribute("stroke-dasharray", sixStrokeDashArray);
  ioSix4.setAttribute("stroke-dasharray", sixStrokeDashArray);
  ioOne1.setAttribute("stroke-dashoffset", "0");
  ioOne2.setAttribute("stroke-dashoffset", "" + (onePathLength * 0.25));
  ioOne3.setAttribute("stroke-dashoffset", "" + (onePathLength * 0.5));
  ioOne4.setAttribute("stroke-dashoffset", "" + (onePathLength * 0.75));
  ioSix1.setAttribute("stroke-dashoffset", "0");
  ioSix2.setAttribute("stroke-dashoffset", "" + (sixPathLength * 0.25));
  ioSix3.setAttribute("stroke-dashoffset", "" + (sixPathLength * 0.5));
  ioSix4.setAttribute("stroke-dashoffset", "" + (sixPathLength * 0.75));
  beginIo16Animation();

  function beginIo16Animation() {
    var oneDurationMillis = common.getDuration(root, 4000);
    var sixDurationMillis = common.getDuration(root, 5000);
    currentIo16Animations.push(animateIo16Stroke(ioOne1, oneDurationMillis, 0));
    currentIo16Animations.push(animateIo16Stroke(ioOne2, oneDurationMillis, onePathLength / 4));
    currentIo16Animations.push(animateIo16Stroke(ioOne3, oneDurationMillis, onePathLength / 2));
    currentIo16Animations.push(animateIo16Stroke(ioOne4, oneDurationMillis, onePathLength * 3 / 4));
    currentIo16Animations.push(animateIo16Stroke(ioSix1, sixDurationMillis, 0));
    currentIo16Animations.push(animateIo16Stroke(ioSix2, sixDurationMillis, sixPathLength / 4));
    currentIo16Animations.push(animateIo16Stroke(ioSix3, sixDurationMillis, sixPathLength / 2));
    currentIo16Animations.push(animateIo16Stroke(ioSix4, sixDurationMillis, sixPathLength * 3 / 4));
  }

  function animateIo16Stroke(element, durationMillis, startingStrokeDashOffset) {
    return element.animate([{
      strokeDashoffset: "" + startingStrokeDashOffset,
      easing: "linear",
      offset: 0
    }, {
      strokeDashoffset: "" + (startingStrokeDashOffset + element.getTotalLength()),
      easing: "linear",
      offset: 1
    }], {
      duration: common.getScaledDuration(root, durationMillis, 2),
      fill: "forwards",
      iterations: "Infinity"
    });
  }

  document.querySelector(root.nodeName + "#" + root.id + " input[id=includes6_slowAnimationCheckbox]").addEventListener("change", function () {
    for (var i = 0; i < currentIo16Animations.length; i += 1) {
      currentIo16Animations[i].cancel();
    }
    currentIo16Animations = [];
    beginIo16Animation();
  });
});

// =======================================================================================
// =======================================================================================
// =======================================================================================
// =============== DEMO: trimming stroked paths, circular indeterminate progress bar
// =======================================================================================
// =======================================================================================
// =======================================================================================

document.addEventListener("DOMContentLoaded", function () {
  function getScaledAnimationDuration(durationMillis) {
    var slowAnimationSelector = document.querySelector("input[id=circularProgressSlowAnimationCheckbox]");
    var currentAnimationDurationFactor = slowAnimationSelector.checked ? 5 : 1;
    return durationMillis * currentAnimationDurationFactor;
  }

  var circular_progress_outer_rotation = document.getElementById("circular_progress_outer_rotation");
  var circular_progress_inner_rotation = document.getElementById("circular_progress_inner_rotation");
  var circle_path = document.getElementById("circular_progress_circle_path");

  function restartAnimation(animation) {
    animation.cancel();
    animation.play();
  }

  function createRotationAnimation() {
    return circular_progress_outer_rotation.animate([
      { transform: "rotate(0deg)", offset: 0, easing: 'linear' },
      { transform: "rotate(720deg)", offset: 1 }
    ], { duration: getScaledAnimationDuration(4444), fill: "forwards", iterations: "Infinity" });
  }

  function createTrimPathOffsetAnimation() {
    return circular_progress_inner_rotation.animate([
      { transform: "rotate(0deg)", offset: 0, easing: 'linear' },
      { transform: "rotate(90deg)", offset: 1 }
    ], { duration: getScaledAnimationDuration(1333), fill: "forwards", iterations: "Infinity" });
  }

  function createTrimPathStartEndAnimation() {
    var fastOutSlowInFunction = bezierEasing(0.4, 0, 0.2, 1);
    var trimPathEndFunction = function (t) {
      if (t <= 0.5) {
        return fastOutSlowInFunction(t * 2) * 0.96;
      } else {
        return 0.08 * t + 0.92;
      }
    };
    var pathLength = circle_path.getTotalLength();
    var keyFrames = [];
    var i = 0;
    for (i = 0; i < 1344; i += 16) {
      var trimPathStart = 0;
      if (i >= 672) {
        trimPathStart = fastOutSlowInFunction(((i - 672) / 672)) * 0.75;
      }
      var trimPathEnd = trimPathEndFunction(i / 1344) * 0.75 + 0.03;
      var trimPathLength = trimPathEnd - trimPathStart;
      keyFrames.push({
        strokeDasharray: (trimPathLength * pathLength) + "," + (1 - trimPathLength) * pathLength,
        strokeDashoffset: (-trimPathStart * pathLength),
        easing: "linear",
        offset: (i / 1344)
      });
    }
    keyFrames.push({
      strokeDasharray: (0.03 * pathLength) + "," + pathLength,
      strokeDashoffset: (-0.75 * pathLength),
      offset: 1
    });
    return circle_path.animate(keyFrames, {
      duration: getScaledAnimationDuration(1333),
      fill: "forwards",
      iterations: "Infinity"
    });
  }

  var outerRotationAnimation = createRotationAnimation();
  var trimPathOffsetAnimation = createTrimPathOffsetAnimation();
  var trimPathStartEndAnimation = createTrimPathStartEndAnimation();

  var outerRotationCheckbox = document.querySelector("input[id=circularProgressOuterRotationCheckbox]");
  var trimPathOffsetCheckbox = document.querySelector("input[id=circularProgressTrimPathOffsetCheckbox]");
  var trimPathStartEndCheckbox = document.querySelector("input[id=circularProgressTrimPathStartEndCheckbox]");
  var showTrimPathsCheckbox = document.querySelector("input[id=circularProgressShowTrimPathsCheckbox]");
  var slowAnimationCheckbox = document.querySelector("input[id=circularProgressSlowAnimationCheckbox]");

  outerRotationCheckbox.addEventListener("change", function () {
    if (outerRotationCheckbox.checked) {
      outerRotationAnimation.play();
    } else {
      outerRotationAnimation.pause();
    }
  });
  trimPathOffsetCheckbox.addEventListener("change", function () {
    if (!trimPathOffsetCheckbox.checked) {
      trimPathOffsetAnimation.pause();
      return;
    }
    if (!trimPathStartEndCheckbox.checked) {
      trimPathOffsetAnimation.play();
      return;
    }
    restartAnimation(trimPathStartEndAnimation);
    restartAnimation(trimPathOffsetAnimation);
  });
  trimPathStartEndCheckbox.addEventListener("change", function () {
    if (!trimPathStartEndCheckbox.checked) {
      trimPathStartEndAnimation.pause();
      return;
    }
    if (!trimPathOffsetCheckbox.checked) {
      trimPathStartEndAnimation.play();
      return;
    }
    restartAnimation(trimPathStartEndAnimation);
    restartAnimation(trimPathOffsetAnimation);
  });
  showTrimPathsCheckbox.addEventListener("change", function () {
    var visibility = showTrimPathsCheckbox.checked ? "visible" : "hidden";
    document.getElementById("circular_progress_circle_path_debug").style.visibility = visibility;
  });
  slowAnimationCheckbox.addEventListener("change", function () {
    outerRotationAnimation.cancel();
    trimPathOffsetAnimation.cancel();
    trimPathStartEndAnimation.cancel();
    if (outerRotationCheckbox.checked) {
      outerRotationAnimation = createRotationAnimation();
    }
    if (trimPathOffsetCheckbox.checked) {
      trimPathOffsetAnimation = createTrimPathOffsetAnimation();
    }
    if (trimPathStartEndCheckbox.checked) {
      trimPathStartEndAnimation = createTrimPathStartEndAnimation();
    }
  });
});

// =======================================================================================
// =======================================================================================
// =======================================================================================
// =============== DEMO: path morphing animated icon demos
// =======================================================================================
// =======================================================================================
// =======================================================================================

document.addEventListener("DOMContentLoaded", function () {

  var plusMinusPaths = [
    "M 5,11 L 11,11 L 11,5 L 13,5 L 13,11 L 19,11 L 19,13 L 13,13 L 13,19 L 11,19 L 11,13 L 5,13 Z",
    "M 5,11 L 11,11 L 11,11 L 13,11 L 13,11 L 19,11 L 19,13 L 13,13 L 13,13 L 11,13 L 11,13 L 5,13 Z"
  ];

  var crossTickPaths = [
    "M6.4,6.4 L17.6,17.6 M6.4,17.6 L17.6,6.4",
    "M4.8,13.4 L9,17.6 M10.4,16.2 L19.6,7"
  ];

  var drawerArrowPaths = [
    "M 3,6 L 3,8 L 21,8 L 21,6 L 3,6 z M 3,11 L 3,13 L 21,13 L 21, 12 L 21,11 L 3,11 z M 3,18 L 3,16 L 21,16 L 21,18 L 3,18 z",
    "M 12, 4 L 10.59,5.41 L 16.17,11 L 18.99,11 L 12,4 z M 4, 11 L 4, 13 L 18.99, 13 L 20, 12 L 18.99, 11 L 4, 11 z M 12,20 L 10.59, 18.59 L 16.17, 13 L 18.99, 13 L 12, 20z"
  ];

  var overflowToArrowPaths = [
    ["M 0,-2 l 0,0 c 1.1046,0 2,0.8954 2,2 l 0,0 c 0,1.1046 -0.8954,2 -2,2 l 0,0 c -1.1046,0 -2,-0.8954 -2,-2 l 0,0 c 0,-1.1046 0.8954,-2 2,-2 Z", "M -4.0951,-1.3095 l 8.1901,0 c 0.1776,0 0.3216,0.1440 0.3216,0.3216 l 0,1.9758 c 0,0.1776 -0.1440,0.3216 -0.3216,0.3216 l -8.1901,0 c -0.1776,0 -0.3216,-0.1440 -0.3216,-0.3216 l 0,-1.9758 c 0,-0.1776 0.1440,-0.3216 0.3216,-0.3216 Z", "M -5.1145,-1.1101 l 10.2291,0 c 0,0 0,0 0,0 l 0,2.2203 c 0,0 0,0 0,0 l -10.2291,0 c 0,0 0,0 0,0 l 0,-2.2203 c 0,0 0,0 0,0 Z", "M -5.4176,-1.0236 l 10.8351,0 c 0,0 0,0 0,0 l 0,2.0471 c 0,0 0,0 0,0 l -10.8351,0 c 0,0 0,0 0,0 l 0,-2.0471 c 0,0 0,0 0,0 Z", "M -5.5,-1 l 11,0 c 0,0 0,0 0,0 l 0,2 c 0,0 0,0 0,0 l -11,0 c 0,0 0,0 0,0 l 0,-2 c 0,0 0,0 0,0 Z"],
    ["M 0,-2 l 0,0 c 1.1046,0 2,0.8954 2,2 l 0,0 c 0,1.1046 -0.8954,2 -2,2 l 0,0 c -1.1046,0 -2,-0.8954 -2,-2 l 0,0 c 0,-1.1046 0.8954,-2 2,-2 Z", "M -0.5106,-1.9149 l 1.0213,0 c 1.0576,0 1.9149,0.8573 1.9149,1.9149 l 0,0 c 0,1.0576 -0.8573,1.9149 -1.9149,1.9149 l -1.0213,0 c -1.0576,0 -1.9149,-0.8573 -1.9149,-1.9149 l 0,0 c 0,-1.0576 0.8573,-1.9149 1.9149,-1.9149 Z", "M -3.6617,-1.5417 l 7.3234,0 c 0.3479,0 0.6299,0.2820 0.6299,0.6299 l 0,1.8234 c 0,0.3479 -0.2820,0.6299 -0.6299,0.6299 l -7.3234,0 c -0.3479,0 -0.6299,-0.2820 -0.6299,-0.6299 l 0,-1.8234 c 0,-0.3479 0.2820,-0.6299 0.6299,-0.6299 Z", "M -5.8061,-1.2245 l 11.6121,0 c 0.0395,0 0.0716,0.0320 0.0716,0.0716 l 0,2.3058 c 0,0.0395 -0.0320,0.0716 -0.0716,0.0716 l -11.6121,0 c -0.0395,0 -0.0716,-0.0320 -0.0716,-0.0716 l 0,-2.3058 c 0,-0.0395 0.0320,-0.0716 0.0716,-0.0716 Z", "M -6.6039,-1.0792 l 13.2077,0 c 0,0 0,0 0,0 l 0,2.1585 c 0,0 0,0 0,0 l -13.2077,0 c 0,0 0,0 0,0 l 0,-2.1585 c 0,0 0,0 0,0 Z", "M -6.9168,-1.0166 l 13.8336,0 c 0,0 0,0 0,0 l 0,2.0333 c 0,0 0,0 0,0 l -13.8336,0 c 0,0 0,0 0,0 l 0,-2.0333 c 0,0 0,0 0,0 Z", "M -7,-1 l 14,0 c 0,0 0,0 0,0 l 0,2 c 0,0 0,0 0,0 l -14,0 c 0,0 0,0 0,0 l 0,-2 c 0,0 0,0 0,0 Z"],
    ["M 0,-2 l 0,0 c 1.1046,0 2,0.8954 2,2 l 0,0 c 0,1.1046 -0.8954,2 -2,2 l 0,0 c -1.1046,0 -2,-0.8954 -2,-2 l 0,0 c 0,-1.1046 0.8954,-2 2,-2 Z", "M -4.0951,-1.3095 l 8.1901,0 c 0.1776,0 0.3216,0.1440 0.3216,0.3216 l 0,1.9758 c 0,0.1776 -0.1440,0.3216 -0.3216,0.3216 l -8.1901,0 c -0.1776,0 -0.3216,-0.1440 -0.3216,-0.3216 l 0,-1.9758 c 0,-0.1776 0.1440,-0.3216 0.3216,-0.3216 Z", "M -5.1145,-1.1101 l 10.2291,0 c 0,0 0,0 0,0 l 0,2.2203 c 0,0 0,0 0,0 l -10.2291,0 c 0,0 0,0 0,0 l 0,-2.2203 c 0,0 0,0 0,0 Z", "M -5.4176,-1.0236 l 10.8351,0 c 0,0 0,0 0,0 l 0,2.0471 c 0,0 0,0 0,0 l -10.8351,0 c 0,0 0,0 0,0 l 0,-2.0471 c 0,0 0,0 0,0 Z", "M -5.5,-1 l 11,0 c 0,0 0,0 0,0 l 0,2 c 0,0 0,0 0,0 l -11,0 c 0,0 0,0 0,0 l 0,-2 c 0,0 0,0 0,0 Z"]
  ];

  var arrowToOverflowPaths = [
    ["M -5.5,-1 l 11,0 c 0,0 0,0 0,0 l 0,2 c 0,0 0,0 0,0 l -11,0 c 0,0 0,0 0,0 l 0,-2 c 0,0 0,0 0,0 Z", "M -5.3496,-1.0430 l 10.6992,0 c 0,0 0,0 0,0 l 0,2.0859 c 0,0 0,0 0,0 l -10.6992,0 c 0,0 0,0 0,0 l 0,-2.0859 c 0,0 0,0 0,0 Z", "M -4.5733,-1.2500 l 9.1465,0 c 0.0286,0 0.0517,0.0232 0.0517,0.0517 l 0,2.3965 c 0,0.0286 -0.0232,0.0517 -0.0517,0.0517 l -9.1465,0 c -0.0286,0 -0.0517,-0.0232 -0.0517,-0.0517 l 0,-2.3965 c 0,-0.0286 0.0232,-0.0517 0.0517,-0.0517 Z", "M -3.0414,-1.5596 l 6.0827,0 c 0.2761,0 0.5,0.2239 0.5,0.5 l 0,2.1192 c 0,0.2761 -0.2239,0.5 -0.5,0.5 l -6.0827,0 c -0.2761,0 -0.5,-0.2239 -0.5,-0.5 l 0,-2.1192 c 0,-0.2761 0.2239,-0.5 0.5,-0.5 Z", "M -1.5586,-1.7755 l 3.1172,0 c 0.6777,0 1.2271,0.5494 1.2271,1.2271 l 0,1.0969 c 0,0.6777 -0.5494,1.2271 -1.2271,1.2271 l -3.1172,0 c -0.6777,0 -1.2271,-0.5494 -1.2271,-1.2271 l 0,-1.0969 c 0,-0.6777 0.5494,-1.2271 1.2271,-1.2271 Z", "M -0.7060,-1.8945 l 1.4120,0 c 0.9186,0 1.6633,0.7447 1.6633,1.6633 l 0,0.4623 c 0,0.9186 -0.7447,1.6633 -1.6633,1.6633 l -1.4120,0 c -0.9186,0 -1.6633,-0.7447 -1.6633,-1.6633 l 0,-0.4623 c 0,-0.9186 0.7447,-1.6633 1.6633,-1.6633 Z", "M -0.2657,-1.9594 l 0.5315,0 c 1.0364,0 1.8765,0.8401 1.8765,1.8765 l 0,0.1658 c 0,1.0364 -0.8401,1.8765 -1.8765,1.8765 l -0.5315,0 c -1.0364,0 -1.8765,-0.8401 -1.8765,-1.8765 l 0,-0.1658 c 0,-1.0364 0.8401,-1.8765 1.8765,-1.8765 Z", "M -0.0581,-1.9910 l 0.1162,0 c 1.0899,0 1.9734,0.8835 1.9734,1.9734 l 0,0.0351 c 0,1.0899 -0.8835,1.9734 -1.9734,1.9734 l -0.1162,0 c -1.0899,0 -1.9734,-0.8835 -1.9734,-1.9734 l 0,-0.0351 c 0,-1.0899 0.8835,-1.9734 1.9734,-1.9734 Z", "M 0,-2 l 0,0 c 1.1046,0 2,0.8954 2,2 l 0,0 c 0,1.1046 -0.8954,2 -2,2 l 0,0 c -1.1046,0 -2,-0.8954 -2,-2 l 0,0 c 0,-1.1046 0.8954,-2 2,-2 Z"],
    ["M -7,-1 l 14,0 c 0,0 0,0 0,0 l 0,2 c 0,0 0,0 0,0 l -14,0 c 0,0 0,0 0,0 l 0,-2 c 0,0 0,0 0,0 Z", " M -4.3684,-1.4999 l 8.7369,0 c 0.0729,0 0.1320,0.0591 0.1320,0.1320 l 0,2.7359 c 0,0.0729 -0.0591,0.1320 -0.1320,0.1320 l -8.7369,0 c -0.0729,0 -0.1320,-0.0591 -0.1320,-0.1320 l 0,-2.7359 c 0,-0.0729 0.0591,-0.1320 0.1320,-0.1320 Z", "M -2.7976,-1.6905 l 5.5952,0 c 0.4142,0 0.7500,0.3358 0.7500,0.7500 l 0,1.8810 c 0,0.4142 -0.3358,0.7500 -0.7500,0.7500 l -5.5952,0 c -0.4142,0 -0.7500,-0.3358 -0.7500,-0.7500 l 0,-1.8810 c 0,-0.4142 0.3358,-0.7500 0.7500,-0.7500 Z", "M -1.5413,-1.8100 l 3.0826,0 c 0.7779,0 1.4085,0.6306 1.4085,1.4085 l 0,0.8031 c 0,0.7779 -0.6306,1.4085 -1.4085,1.4085 l -3.0826,0 c -0.7779,0 -1.4085,-0.6306 -1.4085,-1.4085 l 0,-0.8031 c 0,-0.7779 0.6306,-1.4085 1.4085,-1.4085 Z", "M -0.7987,-1.8899 l 1.5974,0 c 0.9676,0 1.7519,0.7844 1.7519,1.7519 l 0,0.2759 c 0,0.9676 -0.7844,1.7519 -1.7519,1.7519 l -1.5974,0 c -0.9676,0 -1.7519,-0.7844 -1.7519,-1.7519 l 0,-0.2759 c 0,-0.9676 0.7844,-1.7519 1.7519,-1.7519 Z", "M -0.3662,-1.9430 l 0.7324,0 c 1.0597,0 1.9187,0.8590 1.9187,1.9187 l 0,0.0486 c 0,1.0597 -0.8590,1.9187 -1.9187,1.9187 l -0.7324,0 c -1.0597,0 -1.9187,-0.8590 -1.9187,-1.9187 l 0,-0.0486 c 0,-1.0597 0.8590,-1.9187 1.9187,-1.9187 Z", "M -0.1413,-1.9764 l 0.2827,0 c 1.0916,0 1.9764,0.8849 1.9764,1.9764 l 0,0 c 0,1.0916 -0.8849,1.9764 -1.9764,1.9764 l -0.2827,0 c -1.0916,0 -1.9764,-0.8849 -1.9764,-1.9764 l 0,0 c 0,-1.0916 0.8849,-1.9764 1.9764,-1.9764 Z", "M -0.0331,-1.9945 l 0.0663,0 c 1.1015,0 1.9945,0.8930 1.9945,1.9945 l 0,0 c 0,1.1015 -0.8930,1.9945 -1.9945,1.9945 l -0.0663,0 c -1.1015,0 -1.9945,-0.8930 -1.9945,-1.9945 l 0,0 c 0,-1.1015 0.8930,-1.9945 1.9945,-1.9945 Z", "M 0,-2 l 0,0 c 1.1046,0 2,0.8954 2,2 l 0,0 c 0,1.1046 -0.8954,2 -2,2 l 0,0 c -1.1046,0 -2,-0.8954 -2,-2 l 0,0 c 0,-1.1046 0.8954,-2 2,-2 Z"],
    ["M -5.5,-1 l 11,0 c 0,0 0,0 0,0 l 0,2 c 0,0 0,0 0,0 l -11,0 c 0,0 0,0 0,0 l 0,-2 c 0,0 0,0 0,0 Z", "M -5.3496,-1.0430 l 10.6992,0 c 0,0 0,0 0,0 l 0,2.0859 c 0,0 0,0 0,0 l -10.6992,0 c 0,0 0,0 0,0 l 0,-2.0859 c 0,0 0,0 0,0 Z", "M -4.5733,-1.2500 l 9.1465,0 c 0.0286,0 0.0517,0.0232 0.0517,0.0517 l 0,2.3965 c 0,0.0286 -0.0232,0.0517 -0.0517,0.0517 l -9.1465,0 c -0.0286,0 -0.0517,-0.0232 -0.0517,-0.0517 l 0,-2.3965 c 0,-0.0286 0.0232,-0.0517 0.0517,-0.0517 Z", "M -3.0414,-1.5596 l 6.0827,0 c 0.2761,0 0.5,0.2239 0.5,0.5 l 0,2.1192 c 0,0.2761 -0.2239,0.5 -0.5,0.5 l -6.0827,0 c -0.2761,0 -0.5,-0.2239 -0.5,-0.5 l 0,-2.1192 c 0,-0.2761 0.2239,-0.5 0.5,-0.5 Z", "M -1.5586,-1.7755 l 3.1172,0 c 0.6777,0 1.2271,0.5494 1.2271,1.2271 l 0,1.0969 c 0,0.6777 -0.5494,1.2271 -1.2271,1.2271 l -3.1172,0 c -0.6777,0 -1.2271,-0.5494 -1.2271,-1.2271 l 0,-1.0969 c 0,-0.6777 0.5494,-1.2271 1.2271,-1.2271 Z", "M -0.7060,-1.8945 l 1.4120,0 c 0.9186,0 1.6633,0.7447 1.6633,1.6633 l 0,0.4623 c 0,0.9186 -0.7447,1.6633 -1.6633,1.6633 l -1.4120,0 c -0.9186,0 -1.6633,-0.7447 -1.6633,-1.6633 l 0,-0.4623 c 0,-0.9186 0.7447,-1.6633 1.6633,-1.6633 Z", "M -0.2657,-1.9594 l 0.5315,0 c 1.0364,0 1.8765,0.8401 1.8765,1.8765 l 0,0.1658 c 0,1.0364 -0.8401,1.8765 -1.8765,1.8765 l -0.5315,0 c -1.0364,0 -1.8765,-0.8401 -1.8765,-1.8765 l 0,-0.1658 c 0,-1.0364 0.8401,-1.8765 1.8765,-1.8765 Z", "M -0.0581,-1.9910 l 0.1162,0 c 1.0899,0 1.9734,0.8835 1.9734,1.9734 l 0,0.0351 c 0,1.0899 -0.8835,1.9734 -1.9734,1.9734 l -0.1162,0 c -1.0899,0 -1.9734,-0.8835 -1.9734,-1.9734 l 0,-0.0351 c 0,-1.0899 0.8835,-1.9734 1.9734,-1.9734 Z", "M 0,-2 l 0,0 c 1.1046,0 2,0.8954 2,2 l 0,0 c 0,1.1046 -0.8954,2 -2,2 l 0,0 c -1.1046,0 -2,-0.8954 -2,-2 l 0,0 c 0,-1.1046 0.8954,-2 2,-2 Z"],
  ];

  var digitPaths = [
    "M 0.24585635359116,0.552486" +
    " C 0.24585635359116,0.331491712707182 0.370165745856354,0.0994475 0.552486,0.0994475" +
    " C 0.734806629834254,0.0994475 0.86188,0.331491712707182 0.86188,0.552486" +
    " C 0.86188,0.773480662983425 0.734806629834254,0.99448 0.552486,0.99448" +
    " C 0.370165745856354,0.99448 0.24585635359116,0.773480662983425 0.24585635359116,0.552486",
    "M 0.425414364640884,0.11326" +
    " C 0.425414364640884,0.11326 0.57735,0.11326 0.57735,0.11326" +
    " C 0.57735,0.11326 0.57735,1 0.57735,1" +
    " C 0.57735,1 0.57735,1 0.57735,1" +
    " C 0.57735,1 0.57735,1 0.57735,1",
    "M 0.30939226519337,0.331491712707182" +
    " C 0.325966850828729,0.0110497237569061 0.790055248618785,0.0220994475138122 0.798342541436464,0.337016574585635" +
    " C 0.798342541436464,0.43094 0.718232044198895,0.541436464088398 0.596685082872928,0.674033149171271" +
    " C 0.519337016574586,0.762430939226519 0.408839779005525,0.856353591160221 0.314917127071823,0.977901" +
    " C 0.314917127071823,0.977901 0.812154696132597,0.977901 0.812154696132597,0.977901",
    "M 0.361878453038674,0.298342541436464" +
    " C 0.348066298342541,0.149171270718232 0.475138121546961,0.0994475 0.549723756906077,0.0994475" +
    " C 0.86188,0.0994475 0.80663,0.53039 0.549723756906077,0.53039" +
    " C 0.87293,0.53039 0.828729281767956,0.99448 0.552486,0.99448" +
    " C 0.298342541436464,0.99448 0.30939226519337,0.828729281767956 0.312154696132597,0.790055248618785",
    "M 0.856353591160221,0.80663" +
    " C 0.856353591160221,0.80663 0.237569060773481,0.80663 0.237569060773481,0.80663" +
    " C 0.237569060773481,0.80663 0.712707,0.138121546961326 0.712707,0.138121546961326" +
    " C 0.712707,0.138121546961326 0.712707,0.80663 0.712707,0.80663" +
    " C 0.712707,0.80663 0.712707,0.988950276243094 0.712707,0.988950276243094",
    "M 0.80663,0.1105" +
    " C 0.502762430939227,0.1105 0.502762430939227,0.1105 0.502762430939227,0.1105" +
    " C 0.397790055248619,0.43094 0.397790055248619,0.43094 0.397790055248619,0.43094" +
    " C 0.535911602209945,0.364640883977901 0.801104972375691,0.469613259668508 0.801104972375691,0.712707" +
    " C 0.773480662983425,1.01104972375691 0.375690607734807,1.0939226519337 0.248618784530387,0.85083",
    "M 0.607734806629834,0.1105" +
    " C 0.607734806629834,0.1105 0.607734806629834,0.1105 0.607734806629834,0.1105" +
    " C 0.392265193370166,0.43646408839779 0.265193370165746,0.50828729281768 0.25414364640884,0.696132596685083" +
    " C 0.287292817679558,1.13017127071823 0.87293,1.06077348066298 0.845303867403315,0.696132596685083" +
    " C 0.80663,0.364640883977901 0.419889502762431,0.353591160220994 0.295580110497238,0.552486",
    "M 0.259668508287293,0.116022099447514" +
    " C 0.259668508287293,0.116022099447514 0.87293,0.116022099447514 0.87293,0.116022099447514" +
    " C 0.87293,0.116022099447514 0.6667,0.41068139962 0.6667,0.41068139962" +
    " C 0.6667,0.41068139962 0.460405157,0.7053406998 0.460405157,0.7053406998" +
    " C 0.460405157,0.7053406998 0.25414364640884,1 0.25414364640884,1",
    "M 0.558011,0.53039" +
    " C 0.243093922651934,0.524861878453039 0.243093922651934,0.104972375690608 0.558011,0.104972375690608" +
    " C 0.85083,0.104972375690608 0.85083,0.53039 0.558011,0.53039" +
    " C 0.243093922651934,0.53039 0.198895027624309,0.988950276243094 0.558011,0.988950276243094" +
    " C 0.85083,0.988950276243094 0.85083,0.53039 0.558011,0.53039",
    "M 0.80939226519337,0.552486" +
    " C 0.685082872928177,0.751381215469613 0.298342541436464,0.740331491712707 0.259668508287293,0.408839779005525" +
    " C 0.232044198895028,0.0441988950276243 0.81767955801105,-0.0441988950276243 0.85083,0.408839779005525" +
    " C 0.839779005524862,0.596685082872928 0.712707,0.668508287292818 0.497237569060773,0.99448" +
    " C 0.497237569060773,0.99448 0.497237569060773,0.99448 0.497237569060773,0.99448"
  ];

  var playPauseStopPaths = [
    "M9,5 L9,5 L9,13 L4,13 L9,5 M9,5 L9,5 L14,13 L9,13 L9,5",
    "M6,5 L8,5 L8,13 L6,13 L6,5 M10,5 L12,5 L12,13 L10,13 L10,5",
    "M5,5 L9,5 L9,13 L5,13 L5,5 M9,5 L13,5 L13,13 L9,13 L9,5"
  ];

  var playPauseStopTranslationX = [0.75, 0, 0];

  function getScaledAnimationDuration(durationMillis) {
    var slowAnimationSelector = document.querySelector("input[id=pathMorphSlowAnimationCheckbox]");
    var currentAnimationDurationFactor = slowAnimationSelector.checked ? 5 : 1;
    return durationMillis * currentAnimationDurationFactor;
  }

  function animateTranslationX(elementId, durationMillis, fromTranslationX, toTranslationX) {
    animateTranslationXWithEasing(elementId, durationMillis, fromTranslationX, toTranslationX, "cubic-bezier(0.4, 0, 0.2, 1)");
  }

  function animateTranslationXWithEasing(elementId, durationMillis, fromTranslationX, toTranslationX, easingFunction) {
    document.getElementById(elementId).animate([{
      transform: ("translateX(" + fromTranslationX + "px)"),
      offset: 0,
      easing: easingFunction
    }, {
      transform: ("translateX(" + toTranslationX + "px)"),
      offset: 1
    }], {
      duration: getScaledAnimationDuration(durationMillis),
      fill: "forwards"
    });
  }

  function maybeAnimateRotation(elementId, durationMillis, fromDegrees, toDegrees) {
    var rotateSelector = document.querySelector("input[id=pathMorphRotateCheckbox]");
    if (!rotateSelector.checked) {
      return;
    }
    animateRotation(elementId, durationMillis, fromDegrees, toDegrees);
  }

  function animateRotation(elementId, durationMillis, fromDegrees, toDegrees) {
    animateRotationWithEasing(elementId, durationMillis, fromDegrees, toDegrees, "cubic-bezier(0.4, 0, 0.2, 1)");
  }

  function animateRotationWithEasing(elementId, durationMillis, fromDegrees, toDegrees, easingFunction) {
    document.getElementById(elementId).animate([
      { transform: ("rotate(" + fromDegrees + "deg)"), offset: 0, easing: easingFunction },
      { transform: ("rotate(" + toDegrees + "deg)"), offset: 1 }
    ], { duration: getScaledAnimationDuration(durationMillis), fill: "forwards" });
  }

  function animatePathMorph(animationElementId, durationMillis) {
    var animation = document.getElementById(animationElementId);
    animation.setAttributeNS(null, 'dur', getScaledAnimationDuration(durationMillis) + 'ms');
    animation.beginElement();
  }

  function animatePathMorphWithValues(animationElementId, durationMillis, pathStringList) {
    var animation = document.getElementById(animationElementId);
    animation.setAttributeNS(null, 'dur', getScaledAnimationDuration(durationMillis) + 'ms');
    animation.setAttributeNS(null, 'values', pathStringList.join(";"));
    animation.beginElement();
  }

  function animatePoints(animationElementId, durationMillis, fromPathString, toPathString, dotRadius) {
    var listOfPathStrings = [fromPathString, toPathString];
    animatePointsWithList(animationElementId, durationMillis, listOfPathStrings, dotRadius);
  }

  function animatePointsWithList(animationElementId, durationMillis, listOfPathStrings, dotRadius) {
    var valuesString = "";
    for (var i = 0; i < listOfPathStrings.length; i += 1) {
      valuesString = valuesString + common.createPathDotString(listOfPathStrings[i], dotRadius);
      if (i + 1 !== listOfPathStrings.length) {
        valuesString = valuesString + ";";
      }
    }
    var animation = document.getElementById(animationElementId);
    animation.setAttributeNS(null, 'dur', getScaledAnimationDuration(durationMillis) + 'ms');
    animation.setAttributeNS(null, 'values', valuesString, dotRadius);
    animation.beginElement();
  }

  // ================ Plus to minus.
  var isIconMinus = false;
  document.getElementById("ic_plus_minus").addEventListener("click", function () {
    if (isIconMinus) {
      animateMinusToPlus();
    } else {
      animatePlusToMinus();
    }
    isIconMinus = !isIconMinus;
  });

  document.querySelector("input[id=pathMorphShowPathPointsCheckbox]").addEventListener("change", function () {
    var pathPointsSelector = document.querySelector("input[id=pathMorphShowPathPointsCheckbox]");
    var shouldShowPathPoints = pathPointsSelector.checked;
    var visibility = shouldShowPathPoints ? "visible" : "hidden";
    var endPointsPath = document.getElementById("plus_minus_end_points_path");
    endPointsPath.style.visibility = visibility;
    if (shouldShowPathPoints) {
      var dotPathString = common.createPathDotString(plusMinusPaths[isIconMinus ? 1 : 0], 0.4);
      endPointsPath.setAttribute('d', dotPathString);
    }
  });

  function animatePlusToMinus() {
    maybeAnimateRotation("plus_minus_container_rotate", 300, 180, 360);
    animatePathMorph("plus_to_minus_path_animation", 250);
    animatePoints("plus_minus_end_points_animation", 250, plusMinusPaths[0], plusMinusPaths[1], 0.4);
  }

  function animateMinusToPlus() {
    maybeAnimateRotation("plus_minus_container_rotate", 300, 0, 180);
    animatePathMorph("minus_to_plus_path_animation", 250);
    animatePoints("plus_minus_end_points_animation", 250, plusMinusPaths[1], plusMinusPaths[0], 0.4);
  }

  // ================ Cross to tick.
  var isIconTick = false;
  document.getElementById("ic_cross_tick").addEventListener("click", function () {
    if (isIconTick) {
      animateTickToCross();
    } else {
      animateCrossToTick();
    }
    isIconTick = !isIconTick;
  });

  document.querySelector("input[id=pathMorphShowPathPointsCheckbox]").addEventListener("change", function () {
    var pathPointsSelector = document.querySelector("input[id=pathMorphShowPathPointsCheckbox]");
    var shouldShowPathPoints = pathPointsSelector.checked;
    var visibility = shouldShowPathPoints ? "visible" : "hidden";
    var endPointsPath = document.getElementById("cross_tick_end_points_path");
    endPointsPath.style.visibility = visibility;
    if (shouldShowPathPoints) {
      var dotPathString = common.createPathDotString(crossTickPaths[isIconTick ? 1 : 0], 0.4);
      endPointsPath.setAttribute('d', dotPathString);
    }
  });

  function animateCrossToTick() {
    maybeAnimateRotation("cross_tick_container_rotate", 300, 180, 360);
    animatePathMorph("cross_to_tick_path_animation", 250);
    animatePoints("cross_tick_end_points_animation", 250, crossTickPaths[0], crossTickPaths[1], 0.4);
  }

  function animateTickToCross() {
    maybeAnimateRotation("cross_tick_container_rotate", 300, 0, 180);
    animatePathMorph("tick_to_cross_path_animation", 250);
    animatePoints("cross_tick_end_points_animation", 250, crossTickPaths[1], crossTickPaths[0], 0.4);
  }

  // ================ Drawer to arrow.
  var isIconDrawer = true;
  document.getElementById("ic_arrow_drawer").addEventListener("click", function () {
    if (isIconDrawer) {
      animateDrawerToArrow();
    } else {
      animateArrowToDrawer();
    }
    isIconDrawer = !isIconDrawer;
  });

  document.querySelector("input[id=pathMorphShowPathPointsCheckbox]").addEventListener("change", function () {
    var pathPointsSelector = document.querySelector("input[id=pathMorphShowPathPointsCheckbox]");
    var shouldShowPathPoints = pathPointsSelector.checked;
    var visibility = shouldShowPathPoints ? "visible" : "hidden";
    var endPointsPath = document.getElementById("arrow_drawer_end_points_path");
    endPointsPath.style.visibility = visibility;
    if (shouldShowPathPoints) {
      var dotPathString = common.createPathDotString(drawerArrowPaths[isIconDrawer ? 0 : 1], 0.4);
      endPointsPath.setAttribute('d', dotPathString);
    }
  });

  function animateDrawerToArrow() {
    maybeAnimateRotation("arrow_drawer_container_rotate", 300, 0, 180);
    animatePathMorph("drawer_to_arrow_path_animation", 300);
    animatePoints("drawer_arrow_end_points_animation", 300, drawerArrowPaths[0], drawerArrowPaths[1], 0.4);
  }

  function animateArrowToDrawer() {
    maybeAnimateRotation("arrow_drawer_container_rotate", 300, 180, 360);
    animatePathMorph("arrow_to_drawer_path_animation", 300);
    animatePoints("drawer_arrow_end_points_animation", 300, drawerArrowPaths[1], drawerArrowPaths[0], 0.4);
  }

  // ================ Overflow to arrow.
  var isIconOverflow = true;
  var overflowArrowDotRadius = 0.3;
  document.getElementById("ic_arrow_overflow").addEventListener("click", function () {
    if (isIconOverflow) {
      animateOverflowToArrow();
    } else {
      animateArrowToOverflow();
    }
    isIconOverflow = !isIconOverflow;
  });
  document.querySelector("input[id=pathMorphShowPathPointsCheckbox]").addEventListener("change", function () {
    var pathPointsSelector = document.querySelector("input[id=pathMorphShowPathPointsCheckbox]");
    var shouldShowPathPoints = pathPointsSelector.checked;
    var visibility = shouldShowPathPoints ? "visible" : "hidden";
    var endPointsPath1 = document.getElementById("arrow_overflow_end_points_path1");
    var endPointsPath2 = document.getElementById("arrow_overflow_end_points_path2");
    var endPointsPath3 = document.getElementById("arrow_overflow_end_points_path3");
    endPointsPath1.style.visibility = visibility;
    endPointsPath2.style.visibility = visibility;
    endPointsPath3.style.visibility = visibility;
    if (shouldShowPathPoints) {
      var dotPathString1 = common.createPathDotString(isIconOverflow ? overflowToArrowPaths[0][0] : arrowToOverflowPaths[0][0], overflowArrowDotRadius);
      var dotPathString2 = common.createPathDotString(isIconOverflow ? overflowToArrowPaths[1][0] : arrowToOverflowPaths[1][0], overflowArrowDotRadius);
      var dotPathString3 = common.createPathDotString(isIconOverflow ? overflowToArrowPaths[2][0] : arrowToOverflowPaths[2][0], overflowArrowDotRadius);
      endPointsPath1.setAttribute('d', dotPathString1);
      endPointsPath2.setAttribute('d', dotPathString2);
      endPointsPath3.setAttribute('d', dotPathString3);
    }
  });

  function animateOverflowToArrow() {
    animateRotationWithEasing("arrow_overflow_rotate_dot1", 400, 0, -45, "cubic-bezier(0, 0, 0, 1)");
    document.getElementById("arrow_overflow_translate_dot1").animate([{
      transform: "translateX(0px) translateY(-6px)",
      offset: 0,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)"
    }, {
      transform: "translateX(-6.5px) translateY(0px)",
      offset: 1
    }], {
      duration: getScaledAnimationDuration(300),
      fill: "forwards"
    });
    animateTranslationXWithEasing("arrow_overflow_pivot_dot1", 200, 0, 4.5, "cubic-bezier(0, 0, 0, 1)");
    animateTranslationX("arrow_overflow_translate_dot2", 250, 0, -8);
    document.getElementById("arrow_overflow_pivot_dot2").animate([{
      transform: "translateX(0px)",
      offset: 0,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)"
    }, {
      transform: "translateX(8.18181818182px)",
      offset: 0.4
    }, {
      transform: "translateX(9px)",
      offset: 1
    }], {
      duration: getScaledAnimationDuration(200),
      fill: "forwards"
    });
    animateRotationWithEasing("arrow_overflow_rotate_dot3", 400, 0, 45, "cubic-bezier(0, 0, 0, 1)");
    document.getElementById("arrow_overflow_translate_dot3").animate([{
      transform: "translateX(0px) translateY(6px)",
      offset: 0,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)"
    }, {
      transform: "translateX(-6.5px) translateY(0px)",
      offset: 1
    }], {
      duration: getScaledAnimationDuration(300),
      fill: "forwards"
    });
    animateTranslationXWithEasing("arrow_overflow_pivot_dot3", 200, 0, 4.5, "cubic-bezier(0, 0, 0, 1)");
    animatePathMorphWithValues("overflow_to_arrow_path1_animation", 300, overflowToArrowPaths[0]);
    animatePathMorphWithValues("overflow_to_arrow_path2_animation", 300, overflowToArrowPaths[1]);
    animatePathMorphWithValues("overflow_to_arrow_path3_animation", 300, overflowToArrowPaths[2]);
    var endPointsAnimation1 = document.getElementById("arrow_overflow_end_points1_animation");
    endPointsAnimation1.setAttributeNS(null, 'begin', '0ms');
    endPointsAnimation1.setAttributeNS(null, 'keyTimes', '0;0.25;0.5;0.75;1');
    endPointsAnimation1.setAttributeNS(null, 'keySplines', '0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1');
    var endPointsAnimation2 = document.getElementById("arrow_overflow_end_points2_animation");
    endPointsAnimation2.setAttributeNS(null, 'keyTimes', '0;0.1667;0.3333;0.5;0.6666;0.83333;1');
    endPointsAnimation2.setAttributeNS(null, 'keySplines', '0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1');
    endPointsAnimation2.setAttributeNS(null, 'values', overflowToArrowPaths[1]);
    var endPointsAnimation3 = document.getElementById("arrow_overflow_end_points3_animation");
    endPointsAnimation3.setAttributeNS(null, 'begin', '0ms');
    endPointsAnimation3.setAttributeNS(null, 'keyTimes', '0;0.25;0.5;0.75;1');
    endPointsAnimation3.setAttributeNS(null, 'keySplines', '0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1');
    animatePointsWithList("arrow_overflow_end_points1_animation", 300, overflowToArrowPaths[0], overflowArrowDotRadius);
    animatePointsWithList("arrow_overflow_end_points2_animation", 300, overflowToArrowPaths[1], overflowArrowDotRadius);
    animatePointsWithList("arrow_overflow_end_points3_animation", 300, overflowToArrowPaths[2], overflowArrowDotRadius);
  }

  function animateArrowToOverflow() {
    animateRotation("arrow_overflow_rotate_dot1", 400, -45, 0);
    document.getElementById("arrow_overflow_translate_dot1").animate([{
      transform: "translateX(-6.5px) translateY(0px)",
      offset: 0,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)"
    }, {
      transform: "translateX(0px) translateY(-6px)",
      offset: 1
    }], {
      duration: getScaledAnimationDuration(400),
      fill: "forwards"
    });
    animateTranslationX("arrow_overflow_pivot_dot1", 300, 4.5, 0);
    animateTranslationX("arrow_overflow_translate_dot2", 300, -8, 0);
    animateTranslationX("arrow_overflow_pivot_dot2", 216, 9, 0);
    animateRotation("arrow_overflow_rotate_dot3", 400, 45, 0);
    document.getElementById("arrow_overflow_translate_dot3").animate([{
      transform: "translateX(-6.5px) translateY(0px)",
      offset: 0,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)"
    }, {
      transform: "translateX(0px) translateY(6px)",
      offset: 1
    }], {
      duration: getScaledAnimationDuration(400),
      fill: "forwards"
    });
    animateTranslationX("arrow_overflow_pivot_dot3", 300, 4.5, 0);
    document.getElementById("arrow_to_overflow_path1_animation").setAttributeNS(null, 'begin', '50ms');
    document.getElementById("arrow_to_overflow_path3_animation").setAttributeNS(null, 'begin', '50ms');
    animatePathMorphWithValues("arrow_to_overflow_path1_animation", 300, arrowToOverflowPaths[0]);
    animatePathMorphWithValues("arrow_to_overflow_path2_animation", 300, arrowToOverflowPaths[1]);
    animatePathMorphWithValues("arrow_to_overflow_path3_animation", 300, arrowToOverflowPaths[2]);

    var endPointsAnimation1 = document.getElementById("arrow_overflow_end_points1_animation");
    endPointsAnimation1.setAttributeNS(null, 'begin', '50ms');
    endPointsAnimation1.setAttributeNS(null, 'keyTimes', '0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1');
    endPointsAnimation1.setAttributeNS(null, 'keySplines', '0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1');
    var endPointsAnimation2 = document.getElementById("arrow_overflow_end_points2_animation");
    endPointsAnimation2.setAttributeNS(null, 'keyTimes', '0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1');
    endPointsAnimation2.setAttributeNS(null, 'keySplines', '0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1');
    var endPointsAnimation3 = document.getElementById("arrow_overflow_end_points3_animation");
    endPointsAnimation3.setAttributeNS(null, 'begin', '50ms');
    endPointsAnimation3.setAttributeNS(null, 'keyTimes', '0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1');
    endPointsAnimation3.setAttributeNS(null, 'keySplines', '0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1');
    animatePointsWithList("arrow_overflow_end_points1_animation", 300, arrowToOverflowPaths[0], overflowArrowDotRadius);
    animatePointsWithList("arrow_overflow_end_points2_animation", 300, arrowToOverflowPaths[1], overflowArrowDotRadius);
    animatePointsWithList("arrow_overflow_end_points3_animation", 300, arrowToOverflowPaths[2], overflowArrowDotRadius);
  }

  // ================ Play/pause/stop.
  var currentPlayPauseStopIconIndex = 0;
  document.getElementById("ic_play_pause_stop").addEventListener("click", function () {
    var previousPlayPauseStopIconIndex = currentPlayPauseStopIconIndex;
    currentPlayPauseStopIconIndex = (currentPlayPauseStopIconIndex + 1) % 3;
    animatePlayPauseStop(previousPlayPauseStopIconIndex, currentPlayPauseStopIconIndex);
  });

  document.querySelector("input[id=pathMorphRotateCheckbox]").addEventListener("change", function () {
    var animateRotationSelector = document.querySelector("input[id=pathMorphRotateCheckbox]");
    var currentRotation = animateRotationSelector.checked && currentPlayPauseStopIconIndex === 0 ? 90 : 0;
    // TODO(alockwood): fix this hack...
    document.getElementById("play_pause_stop_rotate").animate([{
      transform: "rotate(" + currentRotation + "deg)",
      offset: 0,
    }, {
      transform: "rotate(" + currentRotation + "deg)",
      offset: 1,
    }], {
      duration: 0,
      fill: "forwards"
    });
  });

  document.querySelector("input[id=pathMorphShowPathPointsCheckbox]").addEventListener("change", function () {
    var pathPointsSelector = document.querySelector("input[id=pathMorphShowPathPointsCheckbox]");
    var shouldShowPathPoints = pathPointsSelector.checked;
    var visibility = shouldShowPathPoints ? "visible" : "hidden";
    var endPointsPath = document.getElementById("play_pause_stop_end_points_path");
    endPointsPath.style.visibility = visibility;
    if (shouldShowPathPoints) {
      var dotPathString = common.createPathDotString(playPauseStopPaths[currentPlayPauseStopIconIndex], 0.4);
      endPointsPath.setAttribute('d', dotPathString);
    }
  });

  function animatePlayPauseStop(oldIconIndex, newIconIndex) {
    var startingRotation = 0;
    if (oldIconIndex === 0) {
      startingRotation = 90;
    } else if (oldIconIndex === 1) {
      startingRotation = 0;
    } else if (newIconIndex === 0) {
      startingRotation = 0;
    } else if (newIconIndex === 1) {
      startingRotation = 90;
    }
    maybeAnimateRotation("play_pause_stop_rotate", 200, startingRotation, startingRotation + 90);
    var oldPathString = playPauseStopPaths[oldIconIndex];
    var newPathString = playPauseStopPaths[newIconIndex];
    animatePathMorphWithValues("play_pause_stop_animation", 200, [oldPathString, newPathString]);
    animateTranslationX("play_pause_stop_translateX", 200, playPauseStopTranslationX[oldIconIndex], playPauseStopTranslationX[newIconIndex]);
    animatePoints("play_pause_stop_end_points_animation", 200, oldPathString, newPathString, 0.4);
  }

  // =============== Animated digits.
  var numDigitClicks = 0;
  document.querySelector("input[id=pathMorphShowPathPointsCheckbox]").addEventListener("change", function () {
    var currentPoints = getPointsInPath(0);
    var countdownDigitsCp1Path = document.getElementById("countdown_digits_cp1");
    var countdownDigitsCp2Path = document.getElementById("countdown_digits_cp2");
    var countdownDigitsEndPath = document.getElementById("countdown_digits_end");
    countdownDigitsCp1Path.setAttribute("d", currentPoints[0]);
    countdownDigitsCp2Path.setAttribute("d", currentPoints[1]);
    countdownDigitsEndPath.setAttribute("d", currentPoints[2]);
    var visibility = document.querySelector("input[id=pathMorphShowPathPointsCheckbox]").checked ? "visible" : "hidden";
    countdownDigitsCp1Path.style.visibility = visibility;
    countdownDigitsCp2Path.style.visibility = visibility;
    countdownDigitsEndPath.style.visibility = visibility;
    animateCount(numDigitClicks % 10, numDigitClicks % 10);
  });

  document.getElementById("ic_countdown").addEventListener("click", function () {
    animateCount(numDigitClicks % 10, (numDigitClicks + 1) % 10);
    numDigitClicks += 1;
  });

  function createEllipsePath(radius) {
    var r = radius;
    var d = radius * 2;
    return "m-" + r + ",0a" + r + "," + r + ",0,1,0," + d + ",0a " + r + "," + r + ",0,1,0-" + d + ",0z";
  }

  function createControlPointPath() {
    return createEllipsePath(0.015);
  }

  function createEndPointPath() {
    return createEllipsePath(0.025);
  }

  function getPointsInPath(digit) {
    var digitPath = digitPaths[digit];
    var numbers = digitPath.split(" ");
    var xcoords = [];
    var ycoords = [];
    var numPoints = 0;
    var i;
    for (i = 0; i < numbers.length; i++) {
      var xy = numbers[i].split(",");
      if (xy.length == 2) {
        xcoords.push(xy[0]);
        ycoords.push(xy[1]);
        numPoints++;
      }
    }
    var cp1Path = "";
    var cp2Path = "";
    var endPath = "";
    var controlPointPath = createControlPointPath();
    var endPointPath = createEndPointPath();
    for (i = 0; i < numPoints; i++) {
      var point = "M" + xcoords[i] + "," + ycoords[i];
      if (i % 3 === 0) {
        endPath += point + endPointPath;
      } else if (i % 3 == 1) {
        cp1Path += point + controlPointPath;
      } else {
        cp2Path += point + controlPointPath;
      }
    }
    return [cp1Path, cp2Path, endPath];
  }

  function animateCount(currentDigit, nextDigit) {
    var duration = getScaledAnimationDuration(300);

    var countdownDigitsAnimation = document.getElementById("countdown_digits_animation");
    countdownDigitsAnimation.setAttributeNS(null, 'dur', duration + 'ms');
    countdownDigitsAnimation.setAttributeNS(null, 'values', digitPaths[currentDigit] + ";" + digitPaths[nextDigit]);
    countdownDigitsAnimation.beginElement();

    var currentPoints = getPointsInPath(currentDigit);
    var nextPoints = getPointsInPath(nextDigit);

    var cp1Animation = document.getElementById("countdown_digits_cp1_animation");
    cp1Animation.setAttributeNS(null, 'dur', duration + 'ms');
    cp1Animation.setAttributeNS(null, 'values', currentPoints[0] + ";" + nextPoints[0]);
    cp1Animation.beginElement();

    var cp2Animation = document.getElementById("countdown_digits_cp2_animation");
    cp2Animation.setAttributeNS(null, 'dur', duration + 'ms');
    cp2Animation.setAttributeNS(null, 'values', currentPoints[1] + ";" + nextPoints[1]);
    cp2Animation.beginElement();

    var endAnimation = document.getElementById("countdown_digits_end_animation");
    endAnimation.setAttributeNS(null, 'dur', duration + 'ms');
    endAnimation.setAttributeNS(null, 'values', currentPoints[2] + ";" + nextPoints[2]);
    endAnimation.beginElement();
  }
});

// =======================================================================================
// =======================================================================================
// =======================================================================================
// =============== DEMO: clip path animated icon demos (hourglass, eye visibility, heart)
// =======================================================================================
// =======================================================================================
// =======================================================================================

document.addEventListener("DOMContentLoaded", function () {
  var fastOutSlowIn = "cubic-bezier(0.4, 0, 0.2, 1)";
  var linearOutSlowIn = "cubic-bezier(0, 0, 0.2, 1)";

  function getScaledAnimationDuration(durationMillis) {
    var slowAnimationSelector = document.querySelector("input[id=clipPathSlowAnimationCheckbox]");
    var currentAnimationDurationFactor = slowAnimationSelector.checked ? 5 : 1;
    return durationMillis * currentAnimationDurationFactor;
  }

  function shouldShowDebugClipMasks() {
    return document.querySelector("input[id=clipPathShowClipMaskCheckbox]").checked;
  }

  document.querySelector("input[id=clipPathShowClipMaskCheckbox]").addEventListener("change", function () {
    if (shouldShowDebugClipMasks()) {
      document.getElementById("eye_mask_clip_path_debug").style.visibility = "visible";
      document.getElementById("heart_clip_path_debug").style.visibility = "visible";
      document.getElementById("hourglass_clip_mask_debug").style.visibility = "visible";
    } else {
      document.getElementById("eye_mask_clip_path_debug").style.visibility = "hidden";
      document.getElementById("heart_clip_path_debug").style.visibility = "hidden";
      document.getElementById("hourglass_clip_mask_debug").style.visibility = "hidden";
    }
  });

  // =============== Hourglass icon.
  var isHourglassRotated = false;
  var startHourglassClipPath = "M 24,13.4 c 0,0 -24,0 -24,0 c 0,0 0,10.6 0,10.6 c 0,0 24,0 24,0 c 0,0 0,-10.6 0,-10.6 Z";
  var endHourglassClipPath = "M 24,0 c 0,0 -24,0 -24,0 c 0,0 0,10.7 0,10.7 c 0,0 24,0 24,0 c 0,0 0,-10.7 0,-10.7 Z";
  document.getElementById("ic_timer").addEventListener("click", function () {
    animateHourglass();
    isHourglassRotated = !isHourglassRotated;
  });

  function animateHourglass() {
    var startClip = isHourglassRotated ? endHourglassClipPath : startHourglassClipPath;
    var endClip = isHourglassRotated ? startHourglassClipPath : endHourglassClipPath;
    var startRotate = isHourglassRotated ? "rotate(180deg)" : "rotate(0deg)";
    var endRotate = isHourglassRotated ? "rotate(360deg)" : "rotate(180deg)";
    var clipPathValues = startClip + ";" + endClip;

    document.getElementById("hourglass_fill_rotation").animate([
      { transform: startRotate, offset: 0, easing: fastOutSlowIn },
      { transform: endRotate, offset: 1 }
    ], { duration: getScaledAnimationDuration(333), fill: "forwards" });
    document.getElementById("hourglass_frame_rotation").animate([
      { transform: startRotate, offset: 0, easing: fastOutSlowIn },
      { transform: endRotate, offset: 1 }
    ], { duration: getScaledAnimationDuration(333), fill: "forwards" });

    var startDelay = getScaledAnimationDuration(333);
    var duration = getScaledAnimationDuration(1000);
    var hourglassClipAnimation = document.getElementById("hourglass_clip_mask_animation");
    hourglassClipAnimation.setAttributeNS(null, "begin", startDelay + "ms");
    hourglassClipAnimation.setAttributeNS(null, "dur", duration + "ms");
    hourglassClipAnimation.setAttributeNS(null, "values", clipPathValues);
    hourglassClipAnimation.beginElement();
    var hourglassClipDebugAnimation = document.getElementById("hourglass_clip_mask_debug_animation");
    hourglassClipDebugAnimation.setAttributeNS(null, "begin", startDelay + "ms");
    hourglassClipDebugAnimation.setAttributeNS(null, "dur", duration + "ms");
    hourglassClipDebugAnimation.setAttributeNS(null, "values", clipPathValues);
    hourglassClipDebugAnimation.beginElement();
  }

  // =============== Eye visibility icon.
  var eyeMaskCrossedOut = "M2,4.27 L19.73,22 L22.27,19.46 L4.54,1.73 L4.54,1 L23,1 L23,23 L1,23 L1,4.27 Z";
  var eyeMaskVisible = "M2,4.27 L2,4.27 L4.54,1.73 L4.54,1.73 L4.54,1 L23,1 L23,23 L1,23 L1,4.27 Z";

  var isCrossedOut = true;
  document.getElementById("ic_visibility").addEventListener("click", function () {
    if (isCrossedOut) {
      animateReverseCrossOut();
    } else {
      animateCrossOut();
    }
    isCrossedOut = !isCrossedOut;
  });

  function animateCrossOut() {
    var duration = getScaledAnimationDuration(320);

    var eyeClipAnimation = document.getElementById("eye_mask_animation");
    eyeClipAnimation.setAttributeNS(null, "dur", duration + "ms");
    eyeClipAnimation.setAttributeNS(null, "values", eyeMaskVisible + ";" + eyeMaskCrossedOut);
    eyeClipAnimation.beginElement();

    var eyeClipDebugAnimation = document.getElementById("eye_mask_debug_animation");
    eyeClipDebugAnimation.setAttributeNS(null, "dur", duration + "ms");
    eyeClipDebugAnimation.setAttributeNS(null, "values", eyeMaskVisible + ";" + eyeMaskCrossedOut);
    eyeClipDebugAnimation.beginElement();

    var crossOutPath = document.getElementById("cross_out_path");
    var pathLength = crossOutPath.getTotalLength();
    crossOutPath.animate([
      { strokeDasharray: pathLength, strokeDashoffset: pathLength, offset: 0, easing: fastOutSlowIn },
      { strokeDasharray: pathLength, strokeDashoffset: 0, offset: 1 }
    ], { duration: duration, fill: "forwards" });
  }

  function animateReverseCrossOut() {
    var duration = getScaledAnimationDuration(200);

    var eyeClipAnimation = document.getElementById("eye_mask_animation");
    eyeClipAnimation.setAttributeNS(null, "dur", duration + "ms");
    eyeClipAnimation.setAttributeNS(null, "values", eyeMaskCrossedOut + ";" + eyeMaskVisible);
    eyeClipAnimation.beginElement();

    var eyeClipDebugAnimation = document.getElementById("eye_mask_debug_animation");
    eyeClipDebugAnimation.setAttributeNS(null, "dur", duration + "ms");
    eyeClipDebugAnimation.setAttributeNS(null, "values", eyeMaskCrossedOut + ";" + eyeMaskVisible);
    eyeClipDebugAnimation.beginElement();

    var crossOutPath = document.getElementById("cross_out_path");
    var pathLength = crossOutPath.getTotalLength();
    crossOutPath.animate([
      { strokeDasharray: pathLength, strokeDashoffset: 0, offset: 0, easing: fastOutSlowIn },
      { strokeDasharray: pathLength, strokeDashoffset: pathLength, offset: 1 }
    ], { duration: duration, fill: "forwards" });
  }

  // =============== Heart break icon.
  var isHeartFull = false;
  document.getElementById("ic_heart").addEventListener("click", function () {
    if (isHeartFull) {
      animateHeartToBroken();
    } else {
      animateHeartToFull();
    }
    isHeartFull = !isHeartFull;
  });

  function animateHeartToFull() {
    document.getElementById("heart_full_path").style.visibility = "visible";

    var duration = getScaledAnimationDuration(300);
    var heartFillAnimation = document.getElementById("heart_fill_animation");
    heartFillAnimation.setAttributeNS(null, "dur", duration + "ms");
    heartFillAnimation.beginElement();

    if (shouldShowDebugClipMasks()) {
      document.getElementById("heart_clip_path_debug").style.visibility = "visible";
      var heartFillDebugAnimation = document.getElementById("heart_fill_debug_animation");
      heartFillDebugAnimation.setAttributeNS(null, "dur", duration + "ms");
      heartFillDebugAnimation.beginElement();
    }
  }

  function animateHeartBreak() {
    document.getElementById("heart_clip_path_debug").style.visibility = "hidden";

    document.getElementById("broken_heart_rotate_left_group").animate([
      { transform: "rotate(0deg)", offset: 0, easing: linearOutSlowIn },
      { transform: "rotate(-20deg)", offset: 1 }
    ], { duration: getScaledAnimationDuration(400), fill: "forwards" });
    document.getElementById("broken_heart_rotate_right_group").animate([
      { transform: "rotate(0deg)", offset: 0, easing: linearOutSlowIn },
      { transform: "rotate(20deg)", offset: 1 }
    ], { duration: getScaledAnimationDuration(400), fill: "forwards" });

    var heartBreakLeftPath = document.getElementById("broken_heart_left_path");
    var heartBreakRightPath = document.getElementById("broken_heart_right_path");
    heartBreakLeftPath.animate([
      { fillOpacity: 1, offset: 0 },
      { fillOpacity: 1, offset: 1 }
    ], { duration: 0, fill: "forwards" });
    heartBreakRightPath.animate([
      { fillOpacity: 1, offset: 0 },
      { fillOpacity: 1, offset: 1 }
    ], { duration: 0, fill: "forwards" });
    heartBreakLeftPath.animate([
      { fillOpacity: 1, offset: 0, easing: linearOutSlowIn },
      { fillOpacity: 0, offset: 1 }
    ], { duration: getScaledAnimationDuration(300), fill: "forwards", delay: getScaledAnimationDuration(100) });
    heartBreakRightPath.animate([
      { fillOpacity: 1, offset: 0, easing: linearOutSlowIn },
      { fillOpacity: 0, offset: 1 }
    ], { duration: getScaledAnimationDuration(300), fill: "forwards", delay: getScaledAnimationDuration(100) });
  }

  function animateHeartToBroken() {
    animateHeartBreak();

    var heartStrokeLeftPath = document.getElementById("heart_stroke_left");
    var heartStrokeRightPath = document.getElementById("heart_stroke_right");
    var pathLeftLength = heartStrokeLeftPath.getTotalLength();
    var pathRightLength = heartStrokeRightPath.getTotalLength();
    heartStrokeLeftPath.animate([
      { strokeDasharray: pathLeftLength, strokeDashoffset: pathLeftLength, strokeOpacity: 0, offset: 0 },
      { strokeDasharray: pathLeftLength, strokeDashoffset: pathLeftLength, strokeOpacity: 0, offset: 1 }
    ], { duration: 0, fill: "forwards" });
    heartStrokeRightPath.animate([{ strokeDasharray: pathRightLength, strokeDashoffset: pathRightLength, strokeOpacity: 0, offset: 0 },
      { strokeDasharray: pathRightLength, strokeDashoffset: pathRightLength, strokeOpacity: 0, offset: 1 }
    ], { duration: 0, fill: "forwards" });
    heartStrokeLeftPath.animate([
      { strokeDasharray: pathLeftLength, strokeDashoffset: pathLeftLength, strokeOpacity: 0.4, offset: 0, easing: fastOutSlowIn },
      { strokeDasharray: pathLeftLength, strokeDashoffset: 0, strokeOpacity: 1, offset: 1 }
    ], { duration: getScaledAnimationDuration(300), fill: "forwards", delay: getScaledAnimationDuration(400) });
    heartStrokeRightPath.animate([
      { strokeDasharray: pathRightLength, strokeDashoffset: pathRightLength, strokeOpacity: 0.4, offset: 0, easing: fastOutSlowIn },
      { strokeDasharray: pathRightLength, strokeDashoffset: 0, strokeOpacity: 1, offset: 1 }
    ], { duration: getScaledAnimationDuration(300), fill: "forwards", delay: getScaledAnimationDuration(400) });

    document.getElementById("heart_full_path").style.visibility = "hidden";
  }
});

// =======================================================================================
// =======================================================================================
// =======================================================================================
// =============== DEMO: downloading animated icon demo
// =======================================================================================
// =======================================================================================
// =======================================================================================

document.addEventListener("DOMContentLoaded", function () {
  var root = document.getElementById("includes10");
  var fastOutSlowIn = common.fastOutSlowIn;
  var linearOutSlowIn = common.linearOutSlowIn;
  var downloadingAnimations = [];
  var isDownloading = false;
  var lastKnownTimeMillis = 0;
  var isCompleteAnimationPending = false;
  var downloadingClipMaskDebug = document.getElementById("downloading_arrow_fill_clip_debug");
  var downloadingClipMaskAnimationDebug = document.getElementById("downloading_arrow_fill_clip_animation_debug");
  var downloadingLinePointsPath = document.getElementById("downloading_line_points_path");
  var downloadingLinePointsPathAnimation = document.getElementById("downloading_line_points_path_animation");
  var downloadingCheckArrowPointsPath = document.getElementById("downloading_check_arrow_points_path");
  var downloadingCheckArrowPointsPathAnimation = document.getElementById("downloading_check_arrow_points_path_animation");

  // Setup path morph point paths.
  (function () {
    var i;
    var downloadingLinePaths = [
      "M 50,190 c 0,0 47.66,0 70,0 c 22.34,0 70,0 70,0",
      "M 50,190 c 0,0 47.66,0 70,0 c 22.34,0 70,0 70,0",
      "M 50,190 c 0,0 32.34,19.79 70,19.79 c 37.66,0 70,-19.79 70,-19.79",
      "M 50,190 c 0,0 26.45,-7.98 69.67,-7.98 c 43.21,0 70.33,7.98 70.33,7.98",
      "M 50,190 c 0,0 47.66,0 70,0 c 22.34,0 70,0 70,0"
    ];
    downloadingLinePointsPath.setAttribute("d", common.createPathDotString(downloadingLinePaths[0], 4));
    var downloadingLinePointsValues = [];
    for (i = 0; i < downloadingLinePaths.length; i += 1) {
      downloadingLinePointsValues.push(common.createPathDotString(downloadingLinePaths[i], 4));
    }
    downloadingLinePointsPathAnimation.setAttributeNS(null, "values", downloadingLinePointsValues.join(";"));
    var downloadingCheckArrowPaths = [
      "M 129.12,164 c 0,0 0.88,0 0.88,0 c 0,0 0,-134 0,-134 c 0,0 -20,0 -20,0 c 0,0 -0.1,114.38 -0.1,114.38 c 0,0 -51.8,-0.13 -51.8,-0.13 c 0,0 0.01,19.87 0.01,19.87 c 0,0 68.02,-0.11 68.02,-0.11 c 0,0 2.98,0 2.98,0 Z",
      "M 129.12,164 c 0,0 0.88,0 0.88,0 c 0,0 0,-134 0,-134 c 0,0 -20,0 -20,0 c 0,0 -0.1,114.38 -0.1,114.38 c 0,0 0,-0.02 0,-0.02 c 0,0 0.01,19.87 0.01,19.87 c 0,0 18.4,-0.21 18.4,-0.21 c 0,0 0.81,-0.01 0.81,-0.01 Z",
      "M 119.5,164 c 0,0 10.5,0 10.5,0 c 0,0 0,-134 0,-134 c 0,0 -20,0 -20,0 c 0,0 0,134 0,134 c 0,0 9.5,0 9.5,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 Z",
      "M 119.5,90 c 0,0 30.5,0 30.5,0 c 0,0 0,-60 0,-60 c 0,0 -60,0 -60,0 c 0,0 0,60 0,60 c 0,0 29.5,0 29.5,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 Z",
      "M 119.5,90 c 0,0 30.5,0 30.5,0 c 0,0 0,-60 0,-60 c 0,0 -60,0 -60,0 c 0,0 0,60 0,60 c 0,0 29.5,0 29.5,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 Z",
      "M 190,90 c 0,0 -40,0 -40,0 c 0,0 0,-60 0,-60 c 0,0 -60,0 -60,0 c 0,0 0,60 0,60 c 0,0 -40,0 -40,0 c 0,0 70,70 70,70 c 0,0 70,-70 70,-70 c 0,0 0,0 0,0 Z"
    ];
    downloadingCheckArrowPointsPath.setAttribute("d", common.createPathDotString(downloadingCheckArrowPaths[0], 4));
    var downloadingCheckArrowPointsValues = [];
    for (i = 0; i < downloadingCheckArrowPaths.length; i += 1) {
      downloadingCheckArrowPointsValues.push(common.createPathDotString(downloadingCheckArrowPaths[i], 4));
    }
    downloadingCheckArrowPointsPathAnimation.setAttributeNS(null, "values", downloadingCheckArrowPointsValues.join(";"));
  })();

  document.querySelector(root.nodeName + "#" + root.id + " input[id=includes10_showPathPointsCheckbox]").addEventListener("change", function () {
    var visibility = document.querySelector(root.nodeName + "#" + root.id + " input[id=includes10_showPathPointsCheckbox]").checked ? "visible" : "hidden";
    downloadingLinePointsPath.style.visibility = visibility;
    downloadingCheckArrowPointsPath.style.visibility = visibility;
  });

  document.querySelector(root.nodeName + "#" + root.id + " input[id=includes10_showTrimPathsCheckbox]").addEventListener("change", function () {
    var visibility = document.querySelector(root.nodeName + "#" + root.id + " input[id=includes10_showTrimPathsCheckbox]").checked ? "visible" : "hidden";
    document.getElementById("downloading_progress_bar_check_debug").style.visibility = visibility;
  });

  function shouldShowDebugClipMasks() {
    return document.querySelector(root.nodeName + "#" + root.id + " input[id=includes10_showClipMaskCheckbox]").checked;
  }

  document.querySelector(root.nodeName + "#" + root.id + " input[id=includes10_showClipMaskCheckbox]").addEventListener("change", function () {
    var visibility = (isDownloading && shouldShowDebugClipMasks()) ? "visible" : "hidden";
    downloadingClipMaskDebug.style.visibility = visibility;
  });

  function createProgressBarOuterRotationAnimation() {
    return document.getElementById("downloading_progress_bar_outer_rotation").animate([
      { transform: "rotate(0deg)", offset: 0, easing: 'linear' },
      { transform: "rotate(720deg)", offset: 1 }
    ], { duration: common.getDuration(root, 5332), fill: "forwards", iterations: "Infinity" });
  }

  function createTrimPathOffsetAnimation() {
    return document.getElementById("downloading_progress_bar_inner_rotation").animate([
      { transform: "rotate(0deg)", offset: 0, easing: 'linear' },
      { transform: "rotate(90deg)", offset: 1 }
    ], { duration: common.getDuration(root, 1333), fill: "forwards", iterations: "Infinity" });
  }

  function createTrimPathStartEndAnimation() {
    var downloadingProgressBar = document.getElementById("downloading_progress_bar");
    var fastOutSlowInFunction = bezierEasing(0.4, 0, 0.2, 1);
    var trimPathEndFunction = function (t) {
      if (t <= 0.5) {
        return fastOutSlowInFunction(t * 2) * 0.96;
      } else {
        return 0.08 * t + 0.92;
      }
    };
    var pathLength = downloadingProgressBar.getTotalLength();
    var keyFrames = [];
    for (var i = 0; i < 1344; i += 16) {
      var trimPathStart = 0;
      if (i >= 672) {
        trimPathStart = fastOutSlowInFunction(((i - 672) / 672)) * 0.75;
      }
      var trimPathEnd = trimPathEndFunction(i / 1344) * 0.75 + 0.03;
      var trimPathLength = trimPathEnd - trimPathStart;
      keyFrames.push({
        strokeDasharray: (trimPathLength * pathLength) + "," + (1 - trimPathLength) * pathLength,
        strokeDashoffset: (-trimPathStart * pathLength),
        easing: "linear",
        offset: (i / 1344)
      });
    }
    keyFrames.push({
      strokeDasharray: (0.03 * pathLength) + "," + pathLength,
      strokeDashoffset: (-0.75 * pathLength),
      offset: 1
    });
    return downloadingProgressBar.animate(keyFrames, {
      duration: common.getDuration(root, 1333),
      fill: "forwards",
      iterations: "Infinity"
    });
  }

  function createLineAnimation() {
    var animation = document.getElementById("downloading_line_path_animation");
    animation.setAttributeNS(null, "dur", common.getDuration(root, 714) + "ms");
    animation.beginElement();
    downloadingLinePointsPathAnimation.setAttributeNS(null, "dur", common.getDuration(root, 714) + "ms");
    downloadingLinePointsPathAnimation.beginElement();
    return animation;
  }

  function createCheckToArrowPathMorphAnimation() {
    var animation = document.getElementById("downloading_check_arrow_path_animation");
    animation.setAttributeNS(null, "dur", common.getDuration(root, 833) + "ms");
    animation.beginElement();
    downloadingCheckArrowPointsPathAnimation.setAttributeNS(null, "dur", common.getDuration(root, 833) + "ms");
    downloadingCheckArrowPointsPathAnimation.beginElement();
    return animation;
  }

  function createCheckToArrowPathMotionAnimation() {
    var animation = document.getElementById("downloading_check_arrow_path_motion_animation");
    animation.setAttributeNS(null, "dur", common.getDuration(root, 517) + "ms");
    animation.beginElement();
    return animation;
  }

  function createCheckToArrowRotateAnimation() {
    var checkarrow_rotation = document.getElementById("downloading_check_arrow_group_rotate");
    checkarrow_rotation.animate([
      { transform: "rotate(45deg)", offset: 0, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      { transform: "rotate(0deg)", offset: 1 }
    ], { duration: common.getDuration(root, 517), fill: "forwards", delay: common.getDuration(root, 1800) });
  }

  function createArrowTranslateAnimation() {
    return document.getElementById("downloading_arrow_group_translate").animate([
      { transform: "translate(0px,0px)", easing: "linear", offset: 0 },
      { transform: "translate(0px,-16.38px)", easing: "linear", offset: 0.1525 },
      { transform: "translate(0px,-20px)", easing: "linear", offset: 0.2830 },
      { transform: "translate(0px,-28.98px)", easing: "linear", offset: 0.3364 },
      { transform: "translate(0px,-20px)", easing: "linear", offset: 0.3911 },
      { transform: "translate(0px,32px)", easing: "linear", offset: 0.5437 },
      { transform: "translate(0px,15px)", easing: "linear", offset: 0.6519 },
      { transform: "translate(0px,0px)", offset: 1 }
    ], { duration: common.getDuration(root, 767), fill: "forwards" });
  }

  function createArrowRotateAnimation() {
    return document.getElementById("downloading_arrow_group_rotate").animate([
      { transform: "rotate(0deg)", easing: "linear", offset: 0 },
      { transform: "rotate(0deg)", easing: "cubic-bezier(0.32, 0, 0.23, 1)", offset: 0.1205 },
      { transform: "rotate(10deg)", easing: "linear", offset: 0.4410 },
      { transform: "rotate(10deg)", easing: "cubic-bezier(0.16, 0, 0.23, 1)", offset: 0.7205 },
      { transform: "rotate(0deg)", offset: 1 }
    ], { duration: common.getDuration(root, 415), fill: "forwards" });
  }

  function createFadeFillAnimation(path, durationMillis, startDelayMillis, startOpacity, endOpacity) {
    return path.animate([
      { fillOpacity: startOpacity, offset: 0, easing: fastOutSlowIn },
      { fillOpacity: endOpacity, offset: 1 }
    ], { duration: common.getDuration(root, durationMillis), fill: "forwards", delay: common.getDuration(root, startDelayMillis) });
  }

  function createFadeStrokeAnimation(path, durationMillis, startOpacity, endOpacity) {
    return path.animate([
      { strokeOpacity: startOpacity, offset: 0, easing: fastOutSlowIn },
      { strokeOpacity: endOpacity, offset: 1 }
    ], { duration: common.getDuration(root, durationMillis), fill: "forwards" });
  }

  function createStrokeWidthAnimation(path, durationMillis, startDelayMillis, startWidth, endWidth) {
    return path.animate([
      { strokeWidth: startWidth, offset: 0, easing: linearOutSlowIn },
      { strokeWidth: endWidth, offset: 1 }
    ], { duration: common.getDuration(root, durationMillis), fill: "forwards", delay: common.getDuration(root, startDelayMillis) });
  }

  function createArrowFillAnimation() {
    var duration = common.getDuration(root, 1333);
    var startDelay = common.getDuration(root, 333);
    var animation = document.getElementById("downloading_arrow_fill_clip_animation");
    animation.setAttributeNS(null, 'dur', duration + 'ms');
    animation.setAttributeNS(null, 'begin', startDelay + 'ms');
    animation.beginElement();
    return animation;
  }

  function createArrowFillDebugAnimation() {
    downloadingClipMaskDebug.style.visibility = shouldShowDebugClipMasks() ? "visible" : "hidden";
    var duration = common.getDuration(root, 1333);
    var startDelay = common.getDuration(root, 333);
    var animation = document.getElementById("downloading_arrow_fill_clip_animation_debug");
    animation.setAttributeNS(null, 'dur', duration + 'ms');
    animation.setAttributeNS(null, 'begin', startDelay + 'ms');
    animation.beginElement();
    return animation;
  }

  function createProgressToCheckTrimAnimation(strokePath) {
    var linearOutSlowInFunction = bezierEasing(0, 0, 0.2, 1);
    var pathLength = strokePath.getTotalLength();
    var keyFrames = [];
    for (var i = 0; i <= 1024; i += 16) {
      var trimPathStart = 0;
      var trimPathEnd = linearOutSlowInFunction(i / 1024);
      if (i >= 400) {
        trimPathStart = linearOutSlowInFunction((i - 400) / 624) * 0.88047672583;
      }
      keyFrames.push({
        strokeDasharray: ((trimPathEnd - trimPathStart) * pathLength) + "," + pathLength,
        strokeDashoffset: (-trimPathStart * pathLength),
        easing: "linear",
        offset: (i / 1024)
      });
    }
    return strokePath.animate(keyFrames, {
      duration: common.getDuration(root, 1024),
      fill: "forwards"
    });
  }

  function beginDownloadingAnimation() {
    var arrowPathLight = document.getElementById("downloading_arrow_path");
    var arrowPathDark = document.getElementById("downloading_arrow_filling");
    createFadeFillAnimation(arrowPathLight, 0, 0, 1, 1);
    createFadeFillAnimation(arrowPathDark, 0, 0, 1, 1);
    var checkArrowPath = document.getElementById("downloading_check_arrow_path");
    createFadeFillAnimation(checkArrowPath, 0, 0, 0, 0);
    createFadeFillAnimation(downloadingCheckArrowPointsPath, 0, 0, 0, 0);
    var progressBarPath = document.getElementById("downloading_progress_bar");
    createFadeStrokeAnimation(progressBarPath, 0, 1, 1);
    var progressBarCheckPath = document.getElementById("downloading_progress_bar_check");
    createFadeStrokeAnimation(progressBarCheckPath, 0, 0, 0);
    downloadingAnimations.push(createProgressBarOuterRotationAnimation());
    downloadingAnimations.push(createTrimPathStartEndAnimation());
    downloadingAnimations.push(createTrimPathOffsetAnimation());
    createLineAnimation();
    createArrowTranslateAnimation();
    createArrowRotateAnimation();
    createArrowFillAnimation();
    createArrowFillDebugAnimation();
  }

  function cancelDownloadingAnimations() {
    downloadingClipMaskDebug.style.visibility = "hidden";
    downloadingClipMaskAnimationDebug.endElement();
    for (var i = 0; i < downloadingAnimations.length; i += 1) {
      downloadingAnimations[i].cancel();
    }
    downloadingAnimations = [];
  }

  function beginCompleteAnimation() {
    var progressBarPath = document.getElementById("downloading_progress_bar");
    createFadeStrokeAnimation(progressBarPath, 0, 0, 0);
    var progressBarCheckPath = document.getElementById("downloading_progress_bar_check");
    createFadeStrokeAnimation(progressBarCheckPath, 0, 1, 1);
    var arrowPathLight = document.getElementById("downloading_arrow_path");
    var arrowPathDark = document.getElementById("downloading_arrow_filling");
    createFadeFillAnimation(arrowPathLight, 500, 0, 1, 0);
    createFadeFillAnimation(arrowPathDark, 500, 0, 1, 0);
    // TODO(alockwood): figure out why SMIL won't respect these start delays... :/
    setTimeout(function () {
      isCompleteAnimationPending = false;
      var checkArrowPath = document.getElementById("downloading_check_arrow_path");
      createFadeFillAnimation(checkArrowPath, 0, 0, 1, 1);
      createFadeFillAnimation(downloadingCheckArrowPointsPath, 0, 0, 1, 1);
      createFadeStrokeAnimation(progressBarCheckPath, 0, 0, 0);
      createCheckToArrowPathMorphAnimation();
      createCheckToArrowPathMotionAnimation();
    }, common.getDuration(root, 1800));
    createCheckToArrowRotateAnimation();
    var strokePath = document.getElementById("downloading_progress_bar_check");
    createProgressToCheckTrimAnimation(strokePath);
    createStrokeWidthAnimation(strokePath, 0, 0, 20, 20);
    createStrokeWidthAnimation(strokePath, 500, 800, 20, 14.5);
  }

  document.getElementById("ic_downloading").addEventListener("click", function () {
    if (isCompleteAnimationPending) {
      return;
    }
    if (isDownloading) {
      var scaledDuration = common.getDuration(root, 2666);
      var elapsedTimeMillis = new Date().getTime() - lastKnownTimeMillis;
      var delayTime = scaledDuration - (elapsedTimeMillis % scaledDuration);
      isCompleteAnimationPending = true;
      setTimeout(function () {
        cancelDownloadingAnimations();
        beginCompleteAnimation();
      }, delayTime);
    } else {
      lastKnownTimeMillis = new Date().getTime();
      beginDownloadingAnimation();
    }
    isDownloading = !isDownloading;
  });
});

var common = (function () {
  function getDuration(root, durationMillis) {
    return getScaledDuration(root, durationMillis, 5);
  }

  function getScaledDuration(root, durationMillis, scaleFactor) {
    var selector = document.querySelector(root.nodeName + "#" + root.id + " input[id=" + root.id + "_slowAnimationCheckbox]");
    return durationMillis * (selector.checked ? scaleFactor : 1);
  }

  function addDotToList(pathDataDots, x, y, r) {
    pathDataDots.push({ type: "M", values: [x, y] });
    pathDataDots.push({ type: "m", values: [-r, 0] });
    pathDataDots.push({ type: "a", values: [r, r, 0, 1, 0, r * 2, 0] });
    pathDataDots.push({ type: "a", values: [r, r, 0, 1, 0, -r * 2, 0] });
    pathDataDots.push({ type: "z" });
  }

  function createPathDotString(pathString, dotRadius) {
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute('d', pathString);
    var pathData = path.getPathData({ normalize: true });
    var pathDataDots = [];
    var r = dotRadius;
    for (var i = 0; i < pathData.length; i += 1) {
      var seg = pathData[i];
      if (seg.type === "M" || seg.type === "L") {
        addDotToList(pathDataDots, seg.values[0], seg.values[1], r);
      } else if (seg.type === "C") {
        addDotToList(pathDataDots, seg.values[0], seg.values[1], r);
        addDotToList(pathDataDots, seg.values[2], seg.values[3], r);
        addDotToList(pathDataDots, seg.values[4], seg.values[5], r);
      }
    }
    path.setPathData(pathDataDots);
    return path.getAttribute('d');
  }
  return {
    fastOutSlowIn: "cubic-bezier(0.4, 0, 0.2, 1)",
    fastOutLinearIn: "cubic-bezier(0.4, 0, 1, 1)",
    linearOutSlowIn: "cubic-bezier(0, 0, 0.2, 1)",
    getDuration: getDuration,
    getScaledDuration: getScaledDuration,
    createPathDotString: createPathDotString
  };
})();
}