
 ( function($) {

 	// import Entity model
	// var Entity = exports['Entity'];
	var Entity = require('Entity');	
	var EntityCollection = require('EntityCollection');

	var SearchBox = Backbone.View.extend({		
		timer: null,
		delay: 200,		

		initialize: function() {			
			_.bindAll(this, 'render', 'sthTyped');
			this.render();
		},

		events : {
			'keypress #search-box' : 'sthTyped'
		},

		render : function () {
			var searchBoxHtml = _.template($('#tpl-search-box').html(),{});
			$(this.el).append($(searchBoxHtml));
		},

		sthTyped: function(e) {
			if(this.timer) {
				clearTimeout(this.timer);
			}

			// only set pass value to backend if user stopped 
			// typing for a period of this.delay time.
			this.timer = setTimeout( function() {
				var rego = $('#search-box').val();
				if (rego) {										
					var vechile = new Entity( {
						name : 'Vechile',
						key: {type: 'key_name', value: rego}						
					});
					vechile.fetch();					
				}
			}, this.delay);
		}
	});

	var searchBox = new SearchBox({el: "#content"});
})(jQuery)