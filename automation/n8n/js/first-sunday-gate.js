const berlin = $now.setZone('Europe/Berlin');
if (berlin.weekday !== 7 || berlin.day > 7) return [];
return $input.all();
