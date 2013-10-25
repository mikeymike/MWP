// App object, use to do searches etc
var app = {

    key: "f4bff7377524874c7c2585ea14ed8639",
    apiURL: "http://api.flickr.com/services/rest/",

    data: {
        jsonpElements: [],
        currentCollection: {}
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
     * Fetches a photo collection from Flickr using options provided
     * @param options
     */
    fetchCollection: function(options){
        this.helpers.jsonpCall(options);
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

            for(var i = 0; i < this.data.currentCollection.photo.length; i++){
                this.fetchPhoto(this.data.currentCollection.photo[i]);
            }

        } else app.helpers.handleAPIError(res);
    },

    fetchPhoto: function(photo){
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
        var photo = ich.card(data);
        document.getElementById("photos").innerHTML += photo;
    },

    /**
     * Shows next page of current collection
     */
    showNextPage: function(){
        console.log('Next Called');
        if(app.data.currentCollection.pages > app.data.currentCollection.page){
            // Can show next page
            app.fetchCollection({
                method: "flickr.photos.search",
                lat: app.coords.latitude,
                lon: app.coords.longitude,
                per_page: 50,
                page: app.data.currentCollection.page + 1,
                jsoncallback: "app.handleCollection"
            });
        } else console.log('End of pages');
    }
}


app.helpers = {
    /**
     * @param params Array of params
     * @param callback String name of callback function
     */
    jsonpCall: function(params){
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
        script.id = "jsonp-" + Math.floor((Math.random()*1000)+1)
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
     * @param {Any}    val    Value to be tested
     * @returns    {String}    type name for argument
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
    }
}

/**
 * Catch any API requests without a valid callback
 * @param res Flickr API res
 */
function jsonFlickrApi(res){
    console.log("Err: I don't know how to handle this!");
}


/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
/////////////////////////// App Code ////////////////////////////
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', function(){
    app.init(function(){
        app.fetchCollection({
            method: "flickr.photos.search",
            lat: app.coords.latitude,
            lon: app.coords.longitude,
            per_page: 50,
            has_geo: true,
            radius: 1,
//        geo_context: 2, //May not show results
            jsoncallback: "app.handleCollection"
        });
    });

    var next = document.getElementById('next');
    next.addEventListener('click', app.showNextPage);
}, false);
