(function($) {
	var  TestView = Backbone.View.extend({
		initialize:function() {			
			$(this.el).append($("<span class='test-link save'>test</span>"));
			$('body').append($(this.el));
		},
		events : {
			'click .test-link.save' : 'testFn'
		},

		testFn: function () {
			console.log('sdfdsf');
		}
	});

	tv = new TestView();


	// var Test = Backbone.Model.extend({		
	// 	defaults:{
	// 		a1:"a",
	// 		a2:"b",		
	// 	},

	// 	initialize:function () {
	// 		_.bindAll(this, 'attrsChange')
	// 		this.bind('change',this.attrsChange);
	// 		this.url = '/testCollection' + '?' + 'id=' + this.get('id');
	// 	},

	// 	attrsChange: function() {
	// 		console.log(this.changedAttributes());
	// 		console.log(this.previousAttributes());
	// 		// console.log(obj);
	// 	}

	// });

	// var tt =new Test();
	// // tt.fetch({success:function(model, obj){
		
	// // }});

	// tt.set({a2: "sdfhgsfsfs"});
	// console.log('is new:' + tt.isNew());
	// console.log(tt.attributes);

	// var TestCollection = Backbone.Collection.extend({
	// 	model:Test,
	// 	url: '/testCollection',

	// 	initialize: function() {
	// 		this.testproperty= 'ghsfds';
	// 		this.bind('add',function(e) {
	// 			console.log(e);
	// 		});

	// 		this.bind('change',function(e){
	// 			console.log('changekd');
	// 			console.log(e)
	// 		});
	// 	}


	// });

	// var tt = new TestCollection();
	


	// var successFn = function (e, models) {
	// 	var tst = tt.at(0);
	// 	tst.set({a1: 'gsfdsfdsfesfd'});
	// };

	// var errorFn = function () {console.log('error');
	// 	console.log(arguments);
	// };	

	// tt.fetch({error:errorFn,success:successFn});

 
})(jQuery);