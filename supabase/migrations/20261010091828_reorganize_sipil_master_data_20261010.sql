-- Reorganize existing Sipil items into eight operational groups.
-- Preserves item IDs and report rows; keeps a full master-data rollback snapshot.
create table public.master_data_sipil_backup_20261010 as
select * from public.master_data
where id in (23,24,25,26) or parent_id in (23,24,25,26);

update public.master_data
set sort_order = sort_order + 7, updated_at = now()
where data_type = 'AREA' and is_active = true and id not in (23,24,25,26) and sort_order >= 6;

insert into public.master_data (data_type, parent_id, name, sort_order, is_active)
values
 ('AREA', null, 'SIPIL - Bangunan dan Struktur', 2, true),
 ('AREA', null, 'SIPIL - Atap dan Waterproofing', 3, true),
 ('AREA', null, 'SIPIL - Pintu, Jendela, dan Kaca', 4, true),
 ('AREA', null, 'SIPIL - Plumbing dan Drainase', 5, true),
 ('AREA', null, 'SIPIL - Sanitair dan Perlengkapan Kamar Mandi', 6, true),
 ('AREA', null, 'SIPIL - Furnitur dan Interior', 7, true),
 ('AREA', null, 'SIPIL - Pekerjaan Logam dan Eksterior', 8, true),
 ('AREA', null, 'SIPIL - Lain-lain', 9, true);

with item_map(item_id, area_name) as (
 values
 (71,'SIPIL - Pintu, Jendela, dan Kaca'),(72,'SIPIL - Pintu, Jendela, dan Kaca'),
 (73,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),(74,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (75,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),(76,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (77,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),(78,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (79,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),(80,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (81,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),(82,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (83,'SIPIL - Plumbing dan Drainase'),(84,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (85,'SIPIL - Plumbing dan Drainase'),(86,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (87,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),(88,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (89,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),(90,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (91,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),(92,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (93,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),(94,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (95,'SIPIL - Plumbing dan Drainase'),
 (96,'SIPIL - Pintu, Jendela, dan Kaca'),(97,'SIPIL - Pintu, Jendela, dan Kaca'),
 (98,'SIPIL - Pintu, Jendela, dan Kaca'),(99,'SIPIL - Pintu, Jendela, dan Kaca'),
 (100,'SIPIL - Pintu, Jendela, dan Kaca'),(101,'SIPIL - Pintu, Jendela, dan Kaca'),
 (102,'SIPIL - Pintu, Jendela, dan Kaca'),(103,'SIPIL - Pintu, Jendela, dan Kaca'),
 (104,'SIPIL - Pintu, Jendela, dan Kaca'),(105,'SIPIL - Pintu, Jendela, dan Kaca'),
 (106,'SIPIL - Pintu, Jendela, dan Kaca'),(107,'SIPIL - Pintu, Jendela, dan Kaca'),
 (108,'SIPIL - Pintu, Jendela, dan Kaca'),
 (109,'SIPIL - Furnitur dan Interior'),(110,'SIPIL - Furnitur dan Interior'),
 (111,'SIPIL - Furnitur dan Interior'),(112,'SIPIL - Pintu, Jendela, dan Kaca'),
 (113,'SIPIL - Pintu, Jendela, dan Kaca'),(114,'SIPIL - Furnitur dan Interior'),
 (115,'SIPIL - Furnitur dan Interior'),(116,'SIPIL - Furnitur dan Interior'),
 (117,'SIPIL - Furnitur dan Interior'),(118,'SIPIL - Furnitur dan Interior'),
 (119,'SIPIL - Furnitur dan Interior'),(120,'SIPIL - Furnitur dan Interior'),
 (707,'SIPIL - Lain-lain'),(708,'SIPIL - Bangunan dan Struktur'),
 (121,'SIPIL - Plumbing dan Drainase'),(122,'SIPIL - Pekerjaan Logam dan Eksterior'),
 (123,'SIPIL - Pekerjaan Logam dan Eksterior'),(124,'SIPIL - Furnitur dan Interior'),
 (125,'SIPIL - Pekerjaan Logam dan Eksterior'),(126,'SIPIL - Plumbing dan Drainase'),
 (127,'SIPIL - Pekerjaan Logam dan Eksterior'),(128,'SIPIL - Pekerjaan Logam dan Eksterior'),
 (129,'SIPIL - Furnitur dan Interior'),(130,'SIPIL - Pekerjaan Logam dan Eksterior'),
 (131,'SIPIL - Lain-lain'),(132,'SIPIL - Furnitur dan Interior'),
 (133,'SIPIL - Furnitur dan Interior'),(134,'SIPIL - Furnitur dan Interior'),
 (135,'SIPIL - Furnitur dan Interior'),(136,'SIPIL - Furnitur dan Interior'),
 (137,'SIPIL - Pekerjaan Logam dan Eksterior'),(138,'SIPIL - Furnitur dan Interior'),
 (139,'SIPIL - Furnitur dan Interior'),(140,'SIPIL - Furnitur dan Interior'),
 (141,'SIPIL - Plumbing dan Drainase'),(142,'SIPIL - Furnitur dan Interior'),
 (143,'SIPIL - Pekerjaan Logam dan Eksterior'),(144,'SIPIL - Sanitair dan Perlengkapan Kamar Mandi'),
 (145,'SIPIL - Furnitur dan Interior'),(709,'SIPIL - Furnitur dan Interior'),
 (710,'SIPIL - Furnitur dan Interior'),
 (146,'SIPIL - Bangunan dan Struktur'),(147,'SIPIL - Bangunan dan Struktur'),
 (148,'SIPIL - Bangunan dan Struktur'),(149,'SIPIL - Bangunan dan Struktur'),
 (150,'SIPIL - Bangunan dan Struktur'),(151,'SIPIL - Bangunan dan Struktur'),
 (152,'SIPIL - Atap dan Waterproofing'),(153,'SIPIL - Atap dan Waterproofing'),
 (154,'SIPIL - Atap dan Waterproofing'),(155,'SIPIL - Atap dan Waterproofing'),
 (156,'SIPIL - Bangunan dan Struktur'),(157,'SIPIL - Bangunan dan Struktur'),
 (158,'SIPIL - Bangunan dan Struktur'),(159,'SIPIL - Bangunan dan Struktur'),
 (160,'SIPIL - Bangunan dan Struktur'),(161,'SIPIL - Atap dan Waterproofing'),
 (162,'SIPIL - Plumbing dan Drainase'),(163,'SIPIL - Bangunan dan Struktur'),
 (164,'SIPIL - Bangunan dan Struktur'),(165,'SIPIL - Atap dan Waterproofing'),
 (166,'SIPIL - Bangunan dan Struktur'),(167,'SIPIL - Lain-lain'),
 (168,'SIPIL - Plumbing dan Drainase'),(169,'SIPIL - Furnitur dan Interior'),
 (784,'SIPIL - Pekerjaan Logam dan Eksterior'),
 (792,'SIPIL - Bangunan dan Struktur'),(823,'SIPIL - Plumbing dan Drainase')
)
update public.master_data item
set parent_id = area.id, updated_at = now()
from item_map m
join public.master_data area on area.data_type='AREA' and area.name=m.area_name and area.is_active=true
where item.id=m.item_id and item.data_type='ITEM';

with ranked as (
 select i.id,row_number() over(partition by i.parent_id order by lower(trim(i.name)),i.id) as new_order
 from public.master_data i
 join public.master_data a on a.id=i.parent_id
 where i.data_type='ITEM' and a.data_type='AREA' and a.name like 'SIPIL - %' and i.is_active
)
update public.master_data i
set sort_order=r.new_order, updated_at=now()
from ranked r where i.id=r.id;

update public.master_data
set is_active=false, sort_order=9999, updated_at=now()
where id in (23,24,25,26) and data_type='AREA';
