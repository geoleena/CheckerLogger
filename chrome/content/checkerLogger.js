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

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://checkerlogger/content/checkerObserver.jsm");

CheckerLogger.checkerLogger = function () {
    return {
	// Get the localized string bundle
	strings : CheckerLogger.Cc["@mozilla.org/intl/stringbundle;1"].getService(CheckerLogger.Ci.nsIStringBundleService).createBundle("chrome://checkerlogger/locale/translations.properties"),

        init : function () {
        },

        run : function (window) {
            window.open("chrome://checkerlogger/content/dbbrowser.xul", "clogger", "chrome");
        },

        /* Validate GC code format */
        checkWPFormat: function(wp) {
            if (wp.length < 3 || wp.length > 8)
                return false;

            var an = new RegExp("^GC([0-9]|[A-Z])*$");
            if (!an.test(wp))
                return false;

            return true;
        },

        /* Select and show information for a given GC code */
        selectWP: function(window) {
            var gccode=window.document.getElementById("gccode").value;
            this.select(window, gccode);
        },
        
        /* Select and show information for all GC codes */
        selectAll: function(window) {
            this.select(window, null);
        },

        /* Select and show information for a given GC code (or all if
         * gccode is null). */
        select: function(window, gccode) {
            if (gccode != null) {
                gccode = gccode.toUpperCase();
                if (!this.checkWPFormat(gccode)) {
		    var invalidText = this.strings.GetStringFromName("invalidgc");
                    alert(invalidText + "\n");
                    return;
                }
            }

            var output=window.document.getElementById("output");

            /* Empty the output list */
            for(var i = output.getRowCount() - 1; i >= 0; --i) {
                output.removeItemAt(i);
            }

	    var sortedEntries = CheckerLogger.savedEntries.sort(function(a,b) {
		if (a.wp > b.wp) {
		    return 1;
		} else if (a.wp < b.wp) {
		    return -1;
		} else {
		    return a.timestamp-b.timestamp;
		}
	    });

	    for (var i = 0; i < sortedEntries.length; i++) {
		let wp = sortedEntries[i].wp;
                let latitude = sortedEntries[i].latitude;
                let longitude = sortedEntries[i].longitude;
                let dec_latitude = sortedEntries[i].dec_latitude;
                let dec_longitude = sortedEntries[i].dec_longitude;
                let timestamp = new Date(sortedEntries[i].timestamp);

		if (gccode == null || wp == gccode) {
                    var row = window.document.createElement('listitem');
                    var cell = document.createElement('listcell');
                    cell.setAttribute('label', wp);
                    row.appendChild( cell );
                    cell = document.createElement('listcell');
                    cell.setAttribute('label', latitude);
                    row.appendChild( cell );
                    cell = document.createElement('listcell');
                    cell.setAttribute('label', longitude);
                    row.appendChild( cell );
                    cell = document.createElement('listcell');
                    cell.setAttribute('label', timestamp.toLocaleString());
                    row.appendChild( cell );
                    output.appendChild( row );
		}
	    }
        },

        /* Export information for a given GC code */
        exportWP: function(window) {
            var gccode=window.document.getElementById("gccode").value;
            this.export(window, gccode);
        },
        
        /* Export information for all GC codes */
        exportAll: function(window) {
            this.export(window, null);
        },

	/* Returns exported entries related to gccode (or all if
	 * gccode null) as a csv string. */
	doExport: function(gccode) { var delim = ";";

	    var sortedEntries = CheckerLogger.savedEntries.sort(function(a,b) {
		if (a.wp > b.wp) {
		    return 1;
		} else if (a.wp < b.wp) {
		    return -1;
		} else {
		    return a.timestamp-b.timestamp;
		}
	    });

	    var text = "wp;latitude;longitude;dec_latitude;dec_longitude;timestamp\n";
	    for (var i = 0; i < sortedEntries.length; i++) {
		let wp = sortedEntries[i].wp;
		let latitude = sortedEntries[i].latitude;
		let longitude = sortedEntries[i].longitude;
		let dec_latitude = sortedEntries[i].dec_latitude;
		let dec_longitude = sortedEntries[i].dec_longitude;
		let timestamp = new Date(sortedEntries[i].timestamp);
		
		
		if (gccode == null || wp == gccode) {
		    text = text + wp + delim + latitude + delim + longitude + delim + dec_latitude.toFixed(6) + delim + dec_longitude.toFixed(6) + delim + timestamp.getTime() + "\n";
		}
	    }
	    
	    return text;
	},

        /* Export to a file information for a given GC code (or all GC
         * codes if gccode is null) */
        export: function(window, gccode) {
            if (gccode != null) {
                gccode = gccode.toUpperCase();
                if (!this.checkWPFormat(gccode)) {
		    var invalidText = this.strings.GetStringFromName("invalidgc");
                    alert(invalidText + "\n");
                    return;
                }
            }

	    // Get the file
            const nsIFilePicker = CheckerLogger.Ci.nsIFilePicker;
	    var chooseText = this.strings.GetStringFromName("choosefile");
	    var csvText = this.strings.GetStringFromName("csvfile");

            var fp = CheckerLogger.Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
            fp.init(window, chooseText, nsIFilePicker.modeSave);
            fp.appendFilter(csvText, "*.csv");
            fp.appendFilters(nsIFilePicker.filterAll);

            var rv = fp.show();
            if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
                var file = fp.file;

		if (file.exists() && rv != nsIFilePicker.returnReplace) {
		    // Should not happen...
		    var errorText = this.strings.GetStringFromName("fileexists");
                    if (!window.confirm(errorText)) {
			return;
		    }
		}

                if (!file.exists()) {
                    // Create the file with rw-permissions for user,
                    // none for group and others
                    file.create(file.NORMAL_FILE_TYPE, 0600);
                }

		var data = this.doExport(gccode);

		Components.utils.import("resource://gre/modules/NetUtil.jsm");
		Components.utils.import("resource://gre/modules/FileUtils.jsm");

		var ostream = FileUtils.openSafeFileOutputStream(file);
		var converter = CheckerLogger.Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(CheckerLogger.Ci.nsIScriptableUnicodeConverter);
		converter.charset = "UTF-8";
		var istream = converter.convertToInputStream(data);

		NetUtil.asyncCopy(istream, ostream, function(status) {
		    if (!Components.isSuccessCode(status)) {
			var errorText = CheckerLogger.checkerLogger.strings.GetStringFromName("writefail");
			window.alert(errorText);
			return;
		    }
		});
	    }
        },

        /* Delete information of a given GC code */
        deleteWP: function(window) {
            var gccode=window.document.getElementById("gccode").value;
	    var prompt = this.strings.GetStringFromName("confirmdelete");
            if (window.confirm(prompt + " " + gccode))
                this.delete(window, gccode);
	    this.selectAll(window);
        },
        
        /* Delete information of all GC codes */
        deleteAll: function(window) {
	    var prompt = this.strings.GetStringFromName("confirmdeleteall");
            if (window.confirm(prompt))
                this.delete(window, null);
	    this.selectAll(window);
        },

        /* Delete information of a given GC code (or all if gccode is null) */
        delete: function(window, gccode) {
            if (gccode != null) {
                gccode = gccode.toUpperCase();
                if (!this.checkWPFormat(gccode)) {
		    var invalidText = this.strings.GetStringFromName("invalidgc");
                    alert(invalidText + "\n");
                    return;
                }
            }

	    if (gccode == null) {
		CheckerLogger.savedEntries = [];
	    } else {
		oldEntries = CheckerLogger.savedEntries;
		CheckerLogger.savedEntries = [];
		for (var i = 0; i < oldEntries.length; i++) {
		    if (!(oldEntries[i].wp == gccode)) {
			CheckerLogger.savedEntries.push(oldEntries[i]);
		    }
		}
	    }
        },

	/* Read checker entries from a file */
        importFromFile: function(window) {
            // Get the file
            const nsIFilePicker = CheckerLogger.Ci.nsIFilePicker;
	    var chooseText = this.strings.GetStringFromName("choosefile");
	    var csvText = this.strings.GetStringFromName("csvfile");

            var fp = CheckerLogger.Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
            fp.init(window, chooseText, nsIFilePicker.modeOpen);
            fp.appendFilter(csvText, "*.csv");
            fp.appendFilters(nsIFilePicker.filterAll);

            var rv = fp.show();
            if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
                var file = fp.file;

                // Check that the file exists
		if (!file.isFile() || !file.exists()) {
		    var errorText = this.strings.GetStringFromName("filereaderror");
                    window.alert(errorText);
                    return;
		}

                // The file shoud not be overtly large (limit 10 MB)
		if (file.fileSize > 10485760) {
		    var errorText = this.strings.GetStringFromName("filesizelimit");
		    window.alert(errorText);
		    return;
		}

		Components.utils.import("resource://gre/modules/NetUtil.jsm");

                // Read from the file
                NetUtil.asyncFetch(file, function(inputStream, status) {
                    if (!Components.isSuccessCode(status)) {
			var errorText = CheckerLogger.checkerLogger.strings.GetStringFromName("filereaderror");
                        window.alert(errorText);
                        return;
                    }

                    var csvData = NetUtil.readInputStreamToString(inputStream, inputStream.available());
                    var delim =";";
                    var allTextLines = csvData.split(/\r\n|\n/);
                    var headers = allTextLines[0].split(delim);
                    var lines = [];

                    // Check the format of the file
                    if (headers.length != 6) {
			var errorText = CheckerLogger.checkerLogger.strings.GetStringFromName("invalidformat");
                        window.alert(errorText);
			return;
		    }
                    if (!(headers[0] == "wp") || !(headers[1] == "latitude") || 
                        !(headers[2] == "longitude") || !(headers[3] == "dec_latitude") ||
                        !(headers[4] == "dec_longitude") || !(headers[5] == "timestamp")) {
			var errorText = CheckerLogger.checkerLogger.strings.GetStringFromName("invalidformat");
                        window.alert(errorText);
			return;
                    }

                    // Read the data
                    for (var i=1; i<allTextLines.length; i++) {
                        var data = allTextLines[i].split(delim);
                        if (data.length == headers.length) {
                            var entry = {
                                wp:data[0],
                                latitude: data[1],
                                longitude: data[2],
                                dec_latitude: parseFloat(data[3]),
                                dec_longitude: parseFloat(data[4]),
                                timestamp: (new Date(parseInt(data[5]))).getTime()
                            };
                            CheckerLogger.savedEntries.push(entry);
                        }
                    }
		    CheckerLogger.checkerLogger.selectAll(window);
                });
            }
        }
    };
}();
