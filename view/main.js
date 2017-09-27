$(function(){
	$('#send').on('click', function(){
		$.post("http://localhost:3000/import", function(data) {
			console.log(data);
		});
		console.log($('#file'));
	});
});
