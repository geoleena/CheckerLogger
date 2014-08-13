/*
Copyright (C) 2014 Leena Salmela <geoleena2@gmail.com>

This file is part of CheckerLogger.

CheckerLogger is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at
your option) any later version.

CheckerLogger is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
General Public License for more details.

You should have received a copy of the GNU General Public License
along with CheckerLogger. If not, see <http://www.gnu.org/licenses/>.
*/

var EXPORTED_SYMBOLS = ["CheckerLogger"];

Components.utils.import("resource://gre/modules/Services.jsm");

/* Namespace */
if ("undefined" == typeof(CheckerLogger)) {
   var CheckerLogger = {};
}

CheckerLogger.Cc = Components.classes;
CheckerLogger.Ci = Components.interfaces;

CheckerLogger.savedEntries = [];

CheckerLogger.httpRequestObserver =
{

    /* Extract the value of parameter name from a give POST data string */
    getParameterByName : function(name, poststr) {
        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)", "m"),
            results = regex.exec(poststr);
        return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    },

    /* Observe submissions to GeoChecker  */
    observe: function(subject, topic, data) 
    {
        if (topic == "http-on-modify-request") {
            var httpChannel = subject.QueryInterface(CheckerLogger.Ci.nsIHttpChannel);
            if (httpChannel.requestMethod == "POST") {
                var requestURI = httpChannel.URI.spec;
                var gcfi=new RegExp("www\.geocache\.fi/checker/index\.php","");

                if (gcfi.test(requestURI)) {
                    // Check for private mode
		    // First get the associated window
                    var interfaceRequestor = httpChannel.notificationCallbacks.QueryInterface(CheckerLogger.Ci.nsIInterfaceRequestor);
                    var loadContext;
                    var contentWindow = null;
                    try {
                        loadContext = interfaceRequestor.getInterface(CheckerLogger.Ci.nsILoadContext);
                    } catch (ex) {
                        try {
                            loadContext = aSubject.loadGroup.notificationCallbacks.getInterface(CheckerLogger.Ci.nsILoadContext);
                        } catch (ex2) {
                            loadContext = null;
                        }
                    }
                    if (loadContext) {
                        contentWindow = loadContext.associatedWindow;
                    }
		    if (contentWindow == null) {
                        return;
                    }

                    // Check that the window is not in private mode
                    Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
                    if (!PrivateBrowsingUtils.isWindowPrivate(contentWindow)) {
                        // Get post data
                        channel=httpChannel.QueryInterface(CheckerLogger.Ci.nsIUploadChannel);  
                        channel = channel.uploadStream;  
                        var stream = CheckerLogger.Cc["@mozilla.org/binaryinputstream;1"]
                            .createInstance(CheckerLogger.Ci.nsIBinaryInputStream);  
                        stream.setInputStream(channel);  
                        var postBytes = stream.readByteArray(stream.available());  
                        var poststr = String.fromCharCode.apply(null, postBytes); 
                        // Rewind the stream
                        channel.QueryInterface(CheckerLogger.Ci.nsISeekableStream)
                            .seek(CheckerLogger.Ci.nsISeekableStream.NS_SEEK_SET, 0);  

                        var ns = this.getParameterByName("ns", poststr);
                        var ew = this.getParameterByName("ew", poststr);
                        var lat1 = parseInt(this.getParameterByName("cachelat1", poststr),10);
                        var lat2 = parseInt(this.getParameterByName("cachelat2", poststr),10);
                        var lat3 = parseInt(this.getParameterByName("cachelat3", poststr),10);
                        var lon1 = parseInt(this.getParameterByName("cachelon1", poststr),10);
                        var lon2 = parseInt(this.getParameterByName("cachelon2", poststr),10);
                        var lon3 = parseInt(this.getParameterByName("cachelon3", poststr),10);
                        var wp = this.getParameterByName("wp", poststr);

                        if (!(ns=="" || ew=="" || isNaN(lat1) || isNaN(lat2) || isNaN(lat3) || 
                              isNaN(lon1) || isNaN(lon2) || isNaN(lon3) || wp=="")) {

 	                    var entry = {
                                wp:wp,
                                latitude: ns + " " + lat1 + " " + lat2 + "." + lat3,
                                longitude: ew + " " + lon1 + " " + lon2 + "." + lon3,
                                dec_latitude: lat1 + (lat2 + lat3/1000.0)/60.0,
                                dec_longitude: lon1 + (lon2 + lon3/1000.0)/60.0,
                                timestamp: (new Date()).getTime()
                            };

                            if (ns == "S")
                                entry.dec_latitude = -entry.dec_latitude;
                            if (ew == "W")
                                entry.dec_longitude = -entry.dec_longitude;

                            if (lat3 < 10) {
	                        entry.latitude = ns + " " + lat1 + " " + lat2 + ".00" + lat3;
                            } else if (lat3 < 100) {
	                        entry.latitude = ns + " " + lat1 + " " + lat2 + ".0" + lat3;
                            }
                            if (lon3 < 10) {
	                        entry.longitude = ew + " " + lon1 + " " + lon2 + ".00" + lon3;
                            } else if (lon3 < 100) {
	                        entry.longitude = ew + " " + lon1 + " " + lon2 + ".0" + lon3;
                            }

                            CheckerLogger.savedEntries.push(entry);
                        }
                    }
                }
            }
        }
    }
};

/* Observe cache clearing */
CheckerLogger.sanitizerObserver =
{
    observe: function(subject, topic, data) {
        if (topic == "browser:purge-session-history") {
            CheckerLogger.savedEntries = [];
        }
    }
}

/* Start listening */
CheckerLogger.Cc["@mozilla.org/observer-service;1"].getService(CheckerLogger.Ci.nsIObserverService).addObserver(CheckerLogger.httpRequestObserver, "http-on-modify-request", false);
CheckerLogger.Cc["@mozilla.org/observer-service;1"].getService(CheckerLogger.Ci.nsIObserverService).addObserver(CheckerLogger.sanitizerObserver, "browser:purge-session-history", false);
