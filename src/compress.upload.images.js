/**
 * 多图压缩上传功能，兼容ios&android,同是可以用作多文件上传
 * compress.upload.images
 * @package src/
 * @author rockywu wjl19890427@hotmail.com
 * @created 09-09-2014
 * @site www.rockywu.com
 */
;(function() {
    "use strict";
    var CUI,
        Tools = {
            extend : function(a,b) {
                var k;
                for(k in b) {
                    a[k] = b[k];
                }
                return a;
            },
            rotate : function (cvt, image, w, h, orientation){
                var cvtg;
                if(orientation == 6 || orientation == 8){
                    cvt.width = h;
                    cvt.height = w;
                }else{
                    cvt.width = w;
                    cvt.height = h;
                }
                var cvtg = cvt.getContext("2d");
                if(orientation == 6){
                    cvtg.translate(h, 0);
                    cvtg.rotate(Math.PI / 2);
                }else if(orientation == 8){
                    cvtg.translate(0,w);
                    cvtg.rotate(270*Math.PI/180 );
                }else if(orientation == 3){
                    cvtg.translate(w,h);
                    cvtg.rotate(Math.PI );
                }
                cvtg.drawImage(image, 0, 0);
            }
        };
    CUI = function(params) {
        this.callbackFuns = [ 
            'onSelect',     //文件选择后
            'onDelete',     //文件删除后
            'onProgress',   //文件上传进度
            'onSuccess',    //文件上传成功时
            'onFailure',    //文件上传失败时,
            'onComplete',   //文件全部上传完毕时
            'onMessage',    //文件上传时出现报错提示
            'onCheck',  //自定义验证是否多次上传
        ];
        this.defBoundary = "--image-someboundary--";
        this.defParams = {
            file : null,        //input file dom对象
            uploadUrl : null,   //上传地址
            maxWidth : 0,       //图片压缩最大宽度像素默认为0，不压缩
            maxHeight : 0,      //图片压缩最大高度像素默认为0，不压缩
            inputName : 'file', //设置默认提交的input name 为file
            imageQuality : 100, //默认图片压缩质量为100%
            httpBoundary : this.defBoundary, //默认文件上传的分隔线
            async : true,       //是否异步传输 默认为true
        };
        this.msg = {
            101 : '无法获取file控件',
            102 : '无法获取file文件内容',
            103 : '浏览器无法使用xhr.upload对象'
        };
        this.index = 0;
        this.p = Tools.extend(this.defParams, params);   //统一参数
        this.p.maxWidth = parseInt(this.p.maxWidth);
        this.p.maxHeight = parseInt(this.p.maxHeight);
        this.filesFilter = [];   //文件过滤器
        this.filesName = [];    //文件名保存器
        this.init();            //初始化回调方法
    }
    CUI.prototype = {
        constructor : CUI,
        init : function(p) {
            var k,fun;
            for(k in this.callbackFuns) {
                fun = this.callbackFuns[k];
                if(typeof this.p[fun] === 'function') {
                    this.constructor.prototype[fun] = this.p[fun];
                } else {
                    this.constructor.prototype[fun] = function() {};
                }
            }
        },
        /**
         *  消息提示
         */
        onMessage : function(id, msg) {
            console.log(id + "---" + msg);
        },
        /**
         *  运行上传功能
         */
        doUpload : function() {
            var files, k;
            if(typeof this.p.file !== 'object' || this.p.file === null) {
                this.onMessage(101, this.msg['101']);
                return false;
            }
            files = this.p.file.files;
            if(files.length < 1) {
                this.onMessage('102', this.msg['102']);
                return false;
            }
            for(k = 0; k < files.length; k++) {
                //文件过滤
                if(this.isRepeat(files[k])) {
                    continue;
                }
                if(files[k].type  === "image/jpeg") {
                    if(this.p.maxWidth > 0 && this.p.maxHeight > 0) {
                        this.compressImage(this.index, files[k]);
                    } else {
                        this.uploading(this.index, files[k]);
                    }
                } else {
                    this.uploading(this.index, files[k]);
                }
                this.onSelect(this.index, files[k]);
                this.index++;
            }

        },
        /**
         *  图片类型压缩
         */
        compressImage : function(index, file) {
            var self = this,
                reader = new FileReader(),
                img = document.createElement('img');
            reader.readAsDataURL(file);
            reader.onload = function(e) {
                img.src = this.result;
            }
            img.onload = function() {
                var width = 0,
                    height = 0,
                    base64 = '',
                    mpImg = new MegaPixImage(file),
                    orientation = 1, //照片方向值
                    tmpImg = document.createElement('img');
                if(img.width < self.p.maxWidth && img.height < self.p.maxHeight) {
                    width = img.width;
                    height = img.height;
                } else {
                    if(img.width / self.p.maxWidth > img.height / self.p.maxHeight ) {
                        width = self.p.maxWidth;
                        height = parseInt(img.height * self.p.maxWidth / img.width);
                    } else {
                        width = parseInt(img.width * self.p.maxHeight / img.height);
                        height = self.p.maxHeight;
                    }
                }
                mpImg.render(tmpImg, {maxWidth: width, maxHeight: height });
                EXIF.getData(file, function() {
                    orientation=EXIF.getTag(this,'Orientation');
                    tmpImg.onload=function(){
                        var tmpCvs = document.createElement("canvas"),
                            tmpCtx = tmpCvs.getContext('2d'),
                            data = '';
                        Tools.rotate(tmpCvs, tmpImg, width, height, orientation);
                        if(orientation == 6 || orientation == 8){
                            data = tmpCtx.getImageData(0, 0, height, width);
                        } else {
                            data = tmpCtx.getImageData(0, 0, width, height);
                        }
                        self.uploading(index, file, data, self.p.httpBoundary);
                    }
                });
            }
        },
        /**
         *  开始文件上传
         */
        uploading : function(index, file, data, boundary) {
            var self = this,
                formData,
                xhr;
            if(this.p.async === true) {
                xhr = new XMLHttpRequest();
            } else {
                if(typeof this.xhr === 'undefined') {
                    this.xhr = new XMLHttpRequest();
                }
                xhr = this.xhr;
            }
            if(! xhr.upload){
                this.onMessage(103, this.msg['103']);
                return false;
            }
            // 文件上传中
            xhr.upload.addEventListener("progress", function(e) {
                self.onProgress(index, file, e.loaded, e.total);
            });
            // 文件上传成功或是失败
            xhr.onreadystatechange = function(e) {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        self.onSuccess(index, file, xhr.responseText);
                        self.deleteFile(file);
                        if (!self.filesFilter.length) {
                            //全部完毕
                            self.onComplete();
                        }
                    } else {
                        self.onFailure(index, file, xhr.responseText);
                    }
                }
            };
            // 开始上传
            xhr.open("POST", this.p.uploadUrl, this.p.async === false ? false : true );
            if(typeof data === 'undefined' || data === '') {
                formData = new FormData();
                formData.append('file', file);
                xhr.send(formData);
            } else {
                boundary = boundary || this.p.defBoundary;
                if (XMLHttpRequest.prototype.sendAsBinary === undefined) {
                    XMLHttpRequest.prototype.sendAsBinary = function(string) {
                        var bytes = Array.prototype.map.call(string, function(c) {
                            return c.charCodeAt(0) & 0xff;
                        });
                        this.send(new Uint8Array(bytes).buffer);
                    };
                }
                var myEncoder = new JPEGEncoder(this.p.imageQuality),
                    JPEGImage = myEncoder.encode(data, this.p.imageQuality);
                    data = JPEGImage.substr(23);    //删除base64头
                xhr.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + boundary);
                xhr.sendAsBinary(['--' + boundary, 'Content-Disposition: form-data; name="' + this.p.inputName + '"; filename="' + file.name + '"', 'Content-Type: ' + file.type, '', atob(data), '--' + boundary + '--'].join('\r\n'));
            }

        },
        /**
         *  图片是否重复上传
         */
        isRepeat : function(file) {
            var k, tmp, bool = false;
            for(k=0; k <= this.filesName.length; k++) {
                if(this.filesName[k] === file.name) {
                    bool = true;
                }
            }
            if(this.onCheck(file) && bool) {
                return true;
            } else {
                this.filesName.push(file.name);
                this.filesFilter.push(file.name);
                return false;
            }
        },
        deleteFile : function(file) {
            var k, tmp = this.filesFilter;
            for(k=0; k <= tmp.length; k++) {
                if(tmp[k] === file.name) {
                    this.filesFilter.splice(k, 1);
                    return true;
                }
            }
        },
        onCheck :function(file) {
            return true;
        }
    };

    window.CUI = CUI;
})();
