/**
 * This modiuels controls how and what the vechile 
 * search text box sending fetch request to the server
 * to find the matching vechile. Implement instance 
 * searching here to easy the use of the search.
 *
 * construct 
 */
(function($) {
	var Vechile = Backbone.Model.extend({
		
		url: "/vechile",

		defaults :{
			rego: ""
		},

		initialize: function() {
			_.bindAll(this, 'regoChange');

			this.bind("change", this.regoChange);
		},

		regoChange: function() {			
			this.fetch( {data: {id: v}}, {
				success: function () {
						 
					},
				error: function() {
					console.log('error');
				}
			});
		}
	});

	vechile = new Vechile();
	vechile.set({rego:"qud123", test:"hgsf"});
	vechile.set({rego:"qud123", start:"jfsdf"});

})(jQuery)