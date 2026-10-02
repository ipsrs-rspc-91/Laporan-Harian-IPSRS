const STATIC_KATEGORI = [
    "PEMELIHARAAN RUTIN SESUAI JADWAL",
    "PEMELIHARAAN RUTIN SESUAI JADWAL DENGAN PENGGANTIAN SPARE PART BARU",
    "PEMELIHARAAN DILUAR JADWAL RUTIN",
    "PEMELIHARAAN DILUAR JADWAL RUTIN DENGAN PENGGANTIAN SPARE PART BARU",
    "PERBAIKAN SAJA",
    "PERBAIKAN DENGAN PENGGANTIAN SPARE PART BARU",
    "PENGGANTIAN ATAU PEMASANGAN UNIT /ALAT BARU (PERBAIKAN ATAU PASANG BARU)",
    "PERMINTAAN PELAYANAN ( DILUAR PEMELIHARAAN DAN PERBAIKAN)",
    "MONITORING DAN EVALUASI PEKERJAAN (INTERNAL)",
    "MONITORING DAN EVALUASI PEKERJAAN (PIHAK KE-3)",
    "RAPAT / PERTEMUAN / SOSIALISASI / PELATIHAN",
    "DISPOSISI / MEMO",
    "PROJEK RENOVASI",
    "DISINFEKTAN",
    "ANALISA",
    "AIR BERSIH",
    "CEK LIST HARIAN",
    "CEK LIST MINGGUAN",
    "CEK LIST BULANAN",
    "TEKNIK BERSIH",
    "UMUM / LAIN-nya"
  ];

  const STATIC_AREA = [
    "GENERAL MAINTENANCE",
    "SIPIL  ( Sanitary)",
    "SIPIL  ( Umum 1 )",
    "SIPIl   ( Umum 2 )",
    "SIPIL  ( Kontruksi Bangunan )",
    "M.E. ( Umum )",
    "M.E. ( Penerangan )",
    "M.E. ( Kelistrikan )",
    "M.E. ( AC / Tata Udara / CHILLER )",
    "M.E. ( Telekomunikasi / MA. TV )",
    "M.E. ( Sistem Air Besih )",
    "M.E. ( Heat Pump /Air Panas )",
    "M.E. ( Genset )",
    "M.E. ( Fire Alarm )",
    "M.E. ( Laundry )",
    "M.E. ( Lift  / Eskalator )",
    "M.E. ( Hydrant )",
    "ELEKTROMEDIK  ( Alat Medis )",
    "ELEKTROMEDIK  ( Umum )",
    "ELEKTROMEDIK  ( Gas Medis )",
    "KESLING ( Umum )",
    "KESLING ( Sistem IPAL )",
    "KITCHEN /DAPUR",
    "CEK LIST M.E. / UTILITI",
    "UMUM / Dan Lain - Lain"
  ];

  const ITEMS_BY_AREA = {
    "GENERAL MAINTENANCE": [
      "AC & Listrik",
      "AC & Penerangan",
      "AC & Telekomunikasi",
      "AC, Listrik & Penerangan",
      "AC, Listrik, Penerangan & Telekomunikasi",],
    "SIPIL  ( Sanitary)": [
      "Pintu Kamar Mandi","Jendela Kamar Mandi","Wastafel","Jet Shower","Shower","Bathup","Closet","Flush Closet","Floor Drain","Stop Kran","Gantungan Handuk","Leher Angsa","Pipa Galvanis","Tutup kloset","Pipa PVC","Urinoir","Spoel Hoek","Slop Zinc","selang fleksible","Kran Air","Gantungan shower","Selang fleksible wastafel","kran shower/jet swower","Kran wastafal","pompa air"
    ],
    "SIPIL  ( Umum 1 )": [
      "Pintu kayu / Pintu Besi","Pintu Kaca","Pintu Geser","Handle pintu","Anak kunci","Kunci Lemari","Silinder Kunci","Engsel Pintu / Lemari","Selot Pintu","Door  Closer","Stoper","Jendela","Kaca","Meja","Lemari","Lemari Obat","Capit Udang","Engsel Dorma","Kursi","Kursi Rendeng","HPL / Takon / Pelaminto","ACRYLIC","Rel Laci Meja","Engsel Sendok","Lemari Geser MR"
    ],
    "SIPIl   ( Umum 2 )": [
      "Drill  Got","Gerbang pintu besi","Portal","Loker","Papan Nama","Drill got","HURUF TIMBUL RSPC","Rolling Door","Rel RaK File MR","Kanopi","Akrilik meja / AC Split","Sofa kayu"," Plastik Gordeng","Tatakan  Viorex","laci meja","Meja makan","Pagar besi","sekat triplek","Jongkok - Dingklik pasien","Lemari file","Pipa PPR","Laci Lemari","Jaring penahan Panas","Gantungan Infus kamar mandi","MeJa Konti"
    ],
    "SIPIL  ( Kontruksi Bangunan )": [
      "Tembok/Dinding","Lantai - Keramik - Granit","Lantai - Marmer","Lantai - Vinyl","Plafon - List","Akustik","Genteng","Atap","Banbanan genteng","Solartap","Partisi Gipsum","Partisi Kaca / Acrylic","Partisi Papan / Triplek","Dak beton","Pengecatan ulang","Talang dak","Pipa / Drain","Shap","Asrama PURI","Alderon","Wallguard","gantungan Jam","tutup menhole","Karpet Lantai",],
    "M.E. ( Umum )": [
      "Microwave","Kompor Listrik","Mesin fhoto copy","Hot Trolly","Stir/putaran File","Mesin TIK","Kode Biru","Mesin FEX","Mesin penghancur kertas","Mesin potong rambut","mesin Cuci piring","Plang petunjuk","TOA mushola","Mesin Absen",],
    "M.E. ( Penerangan )": [
      "Saklar Lampu","Lampu LED 18w","Lampu Baca / Bedhead","Lampu LED 14w","Lampu Emergency","Lampu TL LED 14 WATT + 16 WATT","Lampu kulkas","Timer Switch Lampu","Ballast Lampu/ TL 36 Watt","Stater Lampu","Fitting Lampu","Lampu TL 36 w + LED","Lampu HPL / HPIT","Lampu LED DL -Tertutup 7 / 14 watt","TL 18w","Lampu LED 6 WATT + 12 WATT","Lampu PL-C 13 watt","Lampu PL-S 7 watt","Lampu T5 21 watt + 28 watt","Lampu TL36 w","Lampu Pijar 25 watt","Lampu T5 4 watt - 7w - 13 watt","Halopika  20 / 50 watt","Lampu LED 6w","Lampu LED 12w"
    ],
    "M.E. ( Kelistrikan )": [
      "Stop kontak","Steker","Kabel Power / Listrik","Kabel Rol","MCB / MCCB","Fuse","Contactor","Genset","Panel SDP","Panel PP","Panel LP","Panel-Panel","Cubical TM","Transformator","Capasitor Bank","ACB PLN","ACB Genset","Change Over Switch","LVMDP","Gardu PLN","Adaptor DC","Tiang lampu","Lampu LED TL 16w","Stop Kontak AC",],
    "M.E. ( AC / Tata Udara / CHILLER )": [
      "Ac Sentral","Ac Split","Ac Split Duct","AC Standing Floor","Ac Cassette","AC HEPA FILTER","Motor Blower AC LW / Hepa","Pompa Drain Otomatis","Pengatur Suhu / Thermistor","Switch AC Central Honeywell","Kulkas","Air Curtain","Termistor AC","Exhaust Fan","Overload","Motor CWP","Pompa CWP","Motor Fan Blower/Swing ac Split","Panel & Sirkuit Kontrol Chiller","Valve Inlet / Valve Outlet","Remot AC","Pressure Gauge","CAPASITOR FAN -Compresor","Outdoor AC","Compresor AC"
    ],
    "M.E. ( Telekomunikasi / MA. TV )": [
      "Telepon","PABX","Sound Sistem / Paging","Gagang Telp","Speaker","CCTV"," TV/ DVD","Nurce Call","Switch Nurse Call ( NC )","Mesin EDC ( Electronic Data Capture )","Komputer PABX","Sinyal- Kabel jaringan/Antena","BTS","Kabel Spiral","Modulator SKY BOX","Adaptor","FiNGER ACCESS PINTU","HAEDSET -AIPHONE","MESIN CONSUL","Wireless","Remot TV","Intercom","Bel pintu masuk","Roset Telp","Box roset telefon"
    ],
    "M.E. ( Sistem Air Besih )": [
      "Pompa Deep Well","Meteran Air","Ground Tank","Roof Tank","Motor Roof Tank","Pompa Roof Tank","Motor Booster","Pompa Booster","Sensor WLC.","Sensor Radar / Pelampung.","Panel & Sirkuit Kontrol Air Bersih","Valve Inlet.","Valve Outlet.","Instalasi Plumbing Air Bersih","Strainer","Check Valve","Flexible Joint.","Pressure Gauge.","Pressure Tank","Pompa Dorong Air Bersih","Pompa jetpam","Sumur bor",],
    "M.E. ( Heat Pump /Air Panas )": [
      "Heat Pump","Calorifier","Tangki Kalori Fire","Water Heater","Softener","Chamsafe & Dosing Pump","Steam Trap","Pompa Feet Water","Tabung / Selang LPG","Thermostat","Selenoid","Instalasi Pipa Air Panas","Pressure Gauge Heat Pump","Presssure Switch","Check Valve Heat Pump","Flexible Hose","Valve Heat Pump","Tangki Supply Boiler","Motor Jockey Boiler","Pompa Jockey Boiler","Pompa Air Panas","Motor Air Panas","Panel & Sirkuit Kontrol Air Panas","Bell Alarm","pompa feed walter"
    ],
    "M.E. ( Genset )": [
      "Filter Solar","Filter Oli","Filter Udara Genset","OLI","Radiator","Baterai / Accu","Charger Baterai","Tangki Solar","Pompa Solar","Motor ( Pompa Solar)","Water Fuel Separator","MCB / MCCB","Cerobong Asap","Panel Kontrol / AMF Genset","Tes Engine / Running","Selang katup","PLN Padam / Mati"," Keluar barang",],
    "M.E. ( Fire Alarm )": [
      "Smoke Detector","Heat Detector","Terminal Box","Manual Push Botton","Panel Kontrol Fire Alarm","Smoke - Heat Detector",],
    "M.E. ( Laundry )": [
      "Mesin Cuci","Mesin Cuci Infeksius","Mesin Pengering","Sterika Uap","Compressor Angin","Steam","Switch ON - OFF setrika","Box saklar setrika","Troli infeksius","Switch Setrika Uap","Fush Botton","Kabel seterika","Bearing 6204","Swite seterika","Tombol keypad","Selang setrika uap","Pipa Steam",],
    "M.E. ( Lift  / Eskalator )": [
      "Pintu Lift","Lampu Lift","Tombol Lift","Sangkar Lift","Sensor Lift","Mesin / Motor Lift","Panel Kontrol Lift","Accesoris Lift","Maintenance rutin","Alarm Aiopne","Pulley deflector","Escalator","Bearing/ Gear box","Power Supply","by pass lift","telfon lift","Kabel","jadwal rutin ON /OF lift gedung B","Selling Lift","Stiker lantai","Servis rutin","Thysen krup","Gondola","Wire Rope","General Check UP"
    ],
    "M.E. ( Hydrant )": [
      "Sprinker","Box Hydrant","Hydrant Pillar","Jockey Hydrant","Main Motor Hydrant","Mesin Diesel Hydrant","Pressure Tank Hydrant","Pressure Switch Hydrant","Panel Kontrol Hydrant","Pipa hydran","APAR",],
    "ELEKTROMEDIK  ( Alat Medis )": [
      "Stetoskop","BOX X-Ray","Tensimeter","Roller - Pengaduk Darah","Infus Pump","Lampu Blue Light ( BL )","Lampu Infrared / Sorot Pasien","Lampu Operasi","Meja Operasi","Manometer","Monitor Pasien","Mesin RO","USG","TREADMILLE","Nebulizer","Saturasi O2","Compressor Air","Manset","Dental Unit","Rontgen Mobile ( Mobile X-Ray )","Pemindahan Alat HD","Mesin HD","Alat Scrining Suhu / Termometer","Mikroshop","Alat ECHO"
    ],
    "ELEKTROMEDIK  ( Umum )": [
      "Kursi Roda","Trolley Makanan","Roda Trolley / Roda Kursi","Tiang Infus/EEG/dll","Gantungan Infus","Breket","Ukuran Tinggi badan","Timbangan Bayi / Dewasa","Bed head","Brangkar","Remote tempat tidur pasien","UPS","Termometer","Alat Ukur Dindig","Roda rostur"," Intalasi Air RO HD","Vacuum","Timbangan Digital Linen","Trolley 02","Troly obat","Troly linen","Pengukur Suhu Ruangan","Brangkar/Bed","Gantungan /Lemari Apprond",],
    "ELEKTROMEDIK  ( Gas Medis )": [
      "Oksigen (Air Liquid) Sentral","Oksigen (Tabung O2 ) Sentral","Tabung O2 besar","Tabung O2 kecil","Tabung N2O","Tabung Udara Tekan","Outlet O2","Outlet N2O","Outlet Vakum /Suction","Regulator O2","Flow meter","Selang Oksigen","Conektor ventilator","Seal O2","Aqua pack",],
    "KESLING ( Umum )": [
      "Manifest Jalan Hijau","Misting","Fogging","Lampu BL Insect killer","Trap massal","Bilik Disenfeksi","Desinfektan limbah B3","Limbah Medis B3","Bau Bangkai","Dispenser Viorek",],
    "KESLING ( Sistem IPAL )": [
      "IPAL","Sarang Tawon","Microplus","Blower STP","Motor ( Blower STP )","Diffuser","Timer Switch Blower","Pompa Submersible","Communitor","Sensor WLC","Sensor Radar / Pelampung","Valve","Flexible Joint","Limbah B3","Karbon Aktip",],
    "KITCHEN /DAPUR": [
      "Mesin Chiler","Freezer","Mesin Diswashing","MIXER Duduk","Switch on-off","Pipa air panas","Pipa air dingin",],
    "CEK LIST M.E. / UTILITI": [
      "ALL AREA","Cek List Ruang Anggrek","Cek List Panel Listrik","Cek List LMDV","Cek List Genset","Cek List Boiler","Cek List Chiller","Cek List Pompa Deep Well","Cek List Ground Tank","Cek List Roof Tank","Cek List Motor & Pompa Roof Tank","Cek List Motor & Pompa Jockey Boiler","Cek List Motor & Pompa Hydrant","Cek List Motor & Pompa Jockey Hydrant","Cek List Mesin Diesel Hydrant","Cek List Motor & Pompa Air Panas","Cek List Motor & Pompa Booster",],
    "UMUM / Dan Lain - Lain": [
      "Benda Peraga","Rak / Data Try","Thyssenkrupp","Kotak K3RS","Cek List Ruangan","Pihak ke 3","Menurunkan Jenazah","Bau hangus","ASRAMA","pencatatan KWh meter","Foodcourt","Rapat Teknik","Setting sound","OTIS","Selang LPG","Area Dapur","Gantungan Masker","Gordyn","Area Rumah Tangga","Spanduk","Back Drop","Tess Food tender Catring","Rak buku","Lukisan / Gambar","gantungan baju"
    ]
  };
