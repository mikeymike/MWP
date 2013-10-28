// App object, use to do searches etc
var app = {

    key: "f4bff7377524874c7c2585ea14ed8639",
    apiURL: "http://api.flickr.com/services/rest/",
    lock: false, // Set to true when JSONP call is started, false on completion
    photoContainer: null, // Should to be set in init callback function

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
        // Palm beach Florida USA, because why not :)
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
        },

        /**
         * Handles the event for favourite click.
         * TODO: Figure out a way to offer offline functionality
         * @param e
         */
        favouritePhoto: function(e){
            var elem = e.target.parentNode.childNodes[1].children[1];
            if(elem.className == "card-image"){
                console.log(window.location.origin);
                app.apiURL = window.location.origin + "/api.php";
                app.helpers.jsonpCall({
                    image: elem.src,
                    callback: "app.client.test"
                });
            } else console.log('He\'s dead jim');
        },

        test: function(res){
            console.log(res);
        },

        /**
         * Handles touch start by storing elem, and start X pixel
         * @param e
         */
        touchStart: function(e){
            var elem = e.target;
            while(elem.className !== "card"){
                elem = elem.parentNode;
            }
            app.client.touchedElem = elem;
            app.client.touchStartX = e.changedTouches[0].clientX;
        },

        /**
         * Handles touch move, moving elem with move
         * TODO: Throttle ?
         * @param e
         */
        touchMove: function(e){
            var movement = e.changedTouches[0].clientX - app.client.touchStartX;
            app.client.touchedElem.style.left = movement + "px";
        },

        /**
         * Handles touch end removing card if needed or snapping back
         * @param e
         */
        touchEnd: function(e){
            app.client.touchEndX = e.changedTouches[0].clientX;
            var movement = app.client.touchEndX - app.client.touchStartX;
            var threshold = app.client.touchedElem.clientWidth/2;
            if(Math.abs(movement) > threshold){
                app.client.touchedElem.remove();
            } app.client.touchedElem.style.left = 0;
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
     * Calls Fetch Photos to get all photos
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

            this.buildCollectionHtml(this.data.currentCollection);
            this.renderCollection(this.data.currentCollection);

            app.cacheNextPage();

        } else app.helpers.handleAPIError(res);
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
            this.buildCollectionHtml(this.data.nextCollection);
        } else app.helpers.handleAPIError(res);
    },

    /**
     *
     * @param collection
     */
    buildCollectionHtml: function(collection){
        var photoCard;
        collection.html = "";
        for(var i = 0; i < collection.photo.length; i++){
            photoCard = ich.card({
                img: {
                    href: this.helpers.getPhotoURL(collection.photo[i]),
                    alt: collection.photo[i].title,
                    caption: collection.photo[i].title
                }
            });
            collection.html += photoCard;
        }
    },

    /**
     *
     * @param collection
     */
    renderCollection: function(collection){
        app.photoContainer.innerHTML += collection.html;
        app.helpers.addDomEventListers();
    },

    /**
     * Shows next page of current collection checking first in cache then calling fresh if not already cached.
     */
    showNextPage: function(){
        console.log('Show Next Page');
        if(!app.data.pagesEnd){
            if(app.helpers.hasCachedCollection()){

                // Move cached collection over and clear its spot
                app.data.currentCollection = app.data.nextCollection;
                app.data.nextCollection = {};

                // Check if the page is the last one, if so let the app know
                if(this.data.currentCollection.page == this.data.currentCollection.pages){
                    app.data.pagesEnd = true;
                }

                app.renderCollection(app.data.currentCollection);
                app.cacheNextPage();
            } else {
                // For some reason we have managed to get here without next page cached
                // Fetch next page and pass to handleCollection to build && render
                app.helpers.setOption("page", app.data.currentCollection.page + 1);
                app.helpers.setOption("jsoncallback", "app.handleCollection");
                app.fetchCollection();
            }
        } else console.log('End of pages');
    },

    /**
     * Function handles the scroll event for the application
     * Throttles event to every 150 milliseconds with JSONP app.lock when waiting for response
     * TODO: Check if better way, or if this is even going to be good enough!
     * FIXME: Seem to be getting multiple calls to showNextPage on a quick scroll
     */
    handleScroll: function(){
        if(!app.data.pagesEnd){
            var now = new Date().getTime();
            if(!this.hasOwnProperty("lastScroll") || (!app.lock  && !app.data.pagesEnd && now - this.lastScroll > 150)){
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
     * TODO: Specific photo sizes !!! Based on device size !!
     * @param photo
     * @returns {string} photos source url (medium size)
     */
    getPhotoURL: function(photo){
        var fileType = photo.hasOwnProperty("originalformat") ? photo.originalformat : "jpg";
        return "http://farm" + photo.farm + ".staticflickr.com/" +
            photo.server + "/" + photo.id + "_" + photo.secret + "." + fileType;
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
    },

    /**
     * Adds event listeners to all favourite buttons
     * This should be called whenever new cards are added to DOM
     */
    addDomEventListers: function(){
        // Favourite Buttons
        var favs = document.getElementsByClassName('fav');
        for(var i = 0; i < favs.length; i++){
            favs[i].addEventListener("click", app.client.favouritePhoto, false);
        }
        // Touch Events
        var cards = document.getElementsByClassName("card");
        for(var i = 0; i < cards.length; i++){
            cards[i].addEventListener("touchstart", app.client.touchStart);
            cards[i].addEventListener("touchmove", app.client.touchMove);
            cards[i].addEventListener("touchend", app.client.touchEnd);
        }
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
        app.photoContainer = document.getElementById("photos");

        app.helpers.setOptions({
            lat: 29.951066, //app.coords.latitude,
            lon: -90.071532, //app.coords.longitude,
            jsoncallback: "app.handleCollection"
        });

        app.fetchCollection();
        window.addEventListener('scroll', app.handleScroll);
    });
}, false);



// Functions for single photo info
//
//
//    fetchPhoto: function(photo, jsoncallback){
//        app.lock = true;
//        this.helpers.jsonpCall({
//            method: "flickr.photos.getInfo",
//            photo_id: photo.id,
//            jsoncallback: jsoncallback
//        })
//    },
// /**
//     * Function handles app.fetchPhoto response saving to app.data.
//     * @param res JSON individual photo info response from Flickr API
//     */
//    handlePhoto: function(res){
//        this.helpers.removeLastJsonpCall();
//        if(res.stat == "ok"){
//            this.renderPhoto(res.photo);
//        } else app.helpers.handleAPIError(res);
//    },
//
//    /**
//     * Simply renders the given photo
//     */
//    renderPhoto: function(photo){
//        // Build data for template engine
//        var data = {
//            img: {
//                href: this.helpers.getPhotoURL(photo),
//                alt: photo.title._content,
//                caption: photo.description._content
//            }
//        };
//        photoCard = ich.card(data);
//        document.getElementById("photos").innerHTML += photoCard;
//        app.lock = false;
//    },