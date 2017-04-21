/* global $ */ 
$(document).ready(function(){

  $("#myReq").click(function(){
      
    if($('#show1').css('display') == 'none')
{
     $("#show1").show();
     $("#show2").hide();
}
     else 
{
    $("#show1").hide();
}
  });
 
  $("#myTrade").click(function(){
      
    if($('#show2').css('display') == 'none')
{
     $("#show2").show();
     $("#show1").hide();
}
     else 
{
    $("#show2").hide();
}
  });
  
 $(".rotate").click(function(){
 $(this).toggleClass("down");
});
 var pathname = window.location.pathname;
	$('.nav > li > a[href="'+pathname+'"]').parent().addClass('active');
});

 function imgError(image) {
    image.onerror = "";
    image.src = "https://res.cloudinary.com/dlvavuuqe/image/upload/v1492273823/image-not-found_im8zkq.jpg";
    return true;
}
