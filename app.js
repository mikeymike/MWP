// App object, use to do searches etc
var app = {

    key: "f4bff7377524874c7c2585ea14ed8639",
    apiURL: "http://api.flickr.com/services/rest/",
    lock: false, // Set to true when JSONP call is started, false on completion

    data: {
        jsonpElements: [],
        currentCollection: {},
        nextCollection: {},
        pagesEnd: false
    },

    /**
     * Application options used for Flickr search, default values set.
     * Use app.helpers.setOption, app.helpers.removeOption and app.helpers.clearOptions
     */
    options: {
        method: "flickr.photos.search",
        // Palm beach florida :)
        lat: 26.705516,
        lon: -80.057373,
        per_page: 20,
        has_geo: true,
        radius: 2
    },

    /**
     * Client specific stuff, e.g. Viewport functions
     */
    client: {
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight,

        /**
         * Function gets the percentage scrolled down the page.
         * @returns {number} rounded percent scrolled down
         */
        getPercentageScrolled: function(){
            // Get actual page height, Credit to Borgar for code
            // http://stackoverflow.com/questions/1145850/how-to-get-height-of-entire-document-with-javascript
            var body = document.body,
                html = document.documentElement;

            var pageHeight = Math.max( body.scrollHeight, body.offsetHeight,
                html.clientHeight, html.scrollHeight, html.offsetHeight );

            var viewportOffset = window.pageYOffset;

            //Debug
            console.log(Math.round((this.viewportHeight+viewportOffset)/(pageHeight/100)) + "%");

            return Math.round((this.viewportHeight+viewportOffset)/(pageHeight/100));
        }
    },

    /**
     * Handles startup logic and calls App logic
     * @param callback App logic function
     */
    init: function(callback){
        if(!("coords" in this)){
            if(this.helpers.hasGeo()){
                this.coords = navigator.geolocation.getCurrentPosition(function(pos){
                    // Success so save it
                    app.coords = pos.coords;
                    callback();
                }, function(err){
                    //TODO: error logic
                })
            } //TODO: Cry about not having GeoLocation !!!
        }
    },

    /**
     * Fetches a photo collection from Flickr using options from app.options
     */
    fetchCollection: function(){
        this.helpers.jsonpCall(this.options);
    },

    /**
     * Function handles a collection of photos from Flickr
     * Should be called on every search
     * @param res Flickr Response to getting multiple photos
     */
    handleCollection: function(res){
        this.helpers.removeLastJsonpCall();
        if(res.stat == "ok"){

            this.data.currentCollection = res.photos;

            // Set page end if we need to
            if(this.data.currentCollection.page == this.data.currentCollection.pages){
                app.data.pagesEnd = true;
            }

            for(var i = 0; i < this.data.currentCollection.photo.length; i++){
                this.fetchPhoto(this.data.currentCollection.photo[i]);
            }

            app.cacheNextPage();

        } else app.helpers.handleAPIError(res);
    },

    fetchPhoto: function(photo){
        // TODO: Implement app options instead of hard code ?
        app.lock = true;
        this.helpers.jsonpCall({
            method: "flickr.photos.getInfo",
            photo_id: photo.id,
            jsoncallback: "app.handlePhoto"
        })
    },

    /**
     * Function handles app.fetchPhoto response saving to app.data.
     * @param res JSON individual photo info response from Flickr API
     */
    handlePhoto: function(res){
        this.helpers.removeLastJsonpCall();
        if(res.stat == "ok"){
            this.renderPhoto(res.photo);
        } else app.helpers.handleAPIError(res);
        app.lock = false;
    },

    /**
     * Simply renders the given photo
     */
    renderPhoto: function(photo){
        // Build data for template engine
        var data = {
            img: {
                href: this.helpers.getPhotoURL(photo),
                alt: photo.title._content,
                caption: photo.description._content
            }
        };
        photoCard = ich.card(data);
        document.getElementById("photos").innerHTML += photoCard;
    },

    /**
     * Function starts the caching of next page
     */
    cacheNextPage: function(){
        console.log('Cache Next Page');
        app.helpers.setOption("page", app.data.currentCollection.page + 1);
        app.helpers.setOption("jsoncallback", "app.handleCacheCollection");
        app.fetchCollection();
    },

    /**
     * Handles the caching of next page app.cacheNextPage
     * @param res
     */
    handleCacheCollection: function(res){
        this.helpers.removeLastJsonpCall();
        if(res.stat == "ok"){
            this.data.nextCollection = res.photos;
        } else app.helpers.handleAPIError(res);
    },

    /**
     * Shows next page of current collection
     * TODO: Check to see if its already been cached if so then use that otherwise make the JSONP call
     */
    showNextPage: function(){
        console.log('Show Next Page');
        if(!app.data.pagesEnd){
            if(app.helpers.hasCachedCollection()){
                app.data.currentCollection = app.data.nextCollection;
                app.data.nextCollection = {};
                if(this.data.currentCollection.page == this.data.currentCollection.pages){
                    app.data.pagesEnd = true;
                }
                for(var i = 0; i < this.data.currentCollection.photo.length; i++){
                    this.fetchPhoto(this.data.currentCollection.photo[i]);
                }

                app.cacheNextPage();
            } else {
                // Fetch next page
                app.helpers.setOption("page", app.data.currentCollection.page + 1);
                app.helpers.setOption("jsoncallback", "app.handleCollection");
                app.fetchCollection();
            }
        } else console.log('End of pages');
    },

    /**
     * Function handles the scroll event for the application
     * Throttles event to every 300 milliseconds with JSONP app.lock when waiting for response
     * TODO: Check if better way, or if this is even going to be good enough!
     * FIXME: Seem to be getting multiple calls to showNextPage on a quick scroll
     */
    handleScroll: function(){
        if(!app.data.pagesEnd){
            var now = new Date().getTime();
            if(!this.hasOwnProperty("lastScroll") || (!app.lock  && !app.data.pagesEnd && now - this.lastScroll > 300)){
                var percentScrolled = app.client.getPercentageScrolled();
                if(percentScrolled > 95){
                    app.showNextPage();
                }
                this.lastScroll = now;
            }
        }
    }
};


app.helpers = {
    /**
     * Function to make JSONP call, (CORS solution)
     * @param params for Query String
     */
    jsonpCall: function(params){
        app.lock = true;
        // Build Query String
        var count = 0;
        var queryString = "?format=json&api_key=" + app.key + "&";
        for(var k in params){
            count++;
            if(params.hasOwnProperty(k)){
                queryString += k + "=" + params[k];
                if(count != Object.keys(params).length)
                    queryString += "&";
            }
        }
        // Create script tag to make JSONP call
        var script = document.createElement("script");
        script.src = app.apiURL + queryString;
        script.id = "jsonp-" + Math.floor((Math.random()*1000)+1);
        document.getElementsByTagName("head")[0].appendChild(script);
        app.data.jsonpElements.push(script);
    },

    /**
     * Removes the script tag for the last jsonp call
     * Should call this to clear up after callback
     */
    removeLastJsonpCall: function(){
        document.getElementById(app.data.jsonpElements[0].id).remove();
        app.data.jsonpElements.shift();
        app.lock = false; // Reset the lock now!
    },
    
    /**
     * @returns {boolean}
     */
    hasGeo: function(){
        //TODO: implement better test
        // geolocation is often considered a trivial feature detect...
        // Turns out, it's quite tricky to get right:
        //
        // Using !!navigator.geolocation does two things we don't want. It:
        //   1. Leaks memory in IE9: github.com/Modernizr/Modernizr/issues/513
        //   2. Disables page caching in WebKit: webk.it/43956
        //
        // Meanwhile, in Firefox < 8, an about:config setting could expose
        // a false positive that would throw an exception: bugzil.la/688158
        // https://github.com/Modernizr/Modernizr/blob/master/feature-detects/geolocation.js
        return !!navigator.geolocation;
    },

    /**
     * Defacto error function for API failures
     * @param res API response with fail stat
     */
    handleAPIError: function(res){
        console.log("Err: " + res.stat + " Code: " + res.code + " Message: " + res.message);
    },

    /**
     * Not my code: http://jsfiddle.net/johnhunter/s3MeX/
     * Returns the type of the argument
     * @param val obj/var to get type of
     * @returns {string} Type of val
     */
    getType: function(val) {
        if (typeof val === 'undefined') return 'undefined';
        if (typeof val === 'object' && !val) return 'null';
        return ({}).toString.call(val).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
    },

    /**
     * Function builds flickr source url
     * @param photo
     * @returns {string} photos source url (medium size)
     */
    getPhotoURL: function(photo){
        var fileType = photo.hasOwnProperty("originalformat") ? photo.originalformat : "jpg";
        return "http://farm" + photo.farm + ".staticflickr.com/" +
            photo.server + "/" + photo.id + "_" + photo.secret + "_z." + fileType;
    },

    /**
     * Function to set an application option
     * @param key
     * @param value
     */
    setOption: function(key, value){
        app.options[key] = value;
    },

    /**
     * Function to set multiple options using array/object
     * @param options
     */
    setOptions: function(options){
        for(opt in options){
            if(options.hasOwnProperty(opt)){
                this.setOption(opt, options[opt]);
            }
        }
    },

    /**
     * Function to remove an application option
     * @param key
     */
    removeOption: function(key){
        delete app.options[key];
    },

    /**
     * Function to remove all options
     */
    clearOptions: function(){
        app.options = {};
    },

    /**
     * Function checks if app has a cached collection
     * @returns {boolean}
     */
    hasCachedCollection: function(){
        return Object.getOwnPropertyNames(app.data.nextCollection).length > 0;
    }
};

/**
 * Catch any API requests without a valid callback
 * @param res Flickr API res
 */
function jsonFlickrApi(res){
    console.log("Err: I don't know how to handle this!");
    console.log(res);
}


/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
/////////////////////////// App Code ////////////////////////////
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', function(){
    app.init(function(){

        app.helpers.setOptions({
            lat: 52.898446, //app.coords.latitude,
            lon: -1.269778, //app.coords.longitude,
            jsoncallback: "app.handleCollection"
        });

        app.fetchCollection();
        window.addEventListener('scroll', app.handleScroll);
    });

    var next = document.getElementById('next');
    next.addEventListener('click', app.showNextPage);
}, false);
