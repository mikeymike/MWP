<?php
    $img = base64_encode(file_get_contents($_GET['image']));
    $json = json_encode(array("image" => $img, "callback" => $_GET['callback']));
    echo $json;