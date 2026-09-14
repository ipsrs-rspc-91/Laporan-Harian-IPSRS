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
    "M.E. ( Boiler /Air Panas )",
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
      "AC, Listrik, Penerangan & Telekomunikasi",
      "Add1?","Add2?","Add3?","Add4?","Add5?","Add6?","Add7?","Add8?","Add9?","Add10?","Add11?","Add12?","Add13?","Add14?","Add15?","Add16?","Add17?","Add18?","Add19?"
    ],
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
      "Tembok/Dinding","Lantai - Keramik - Granit","Lantai - Marmer","Lantai - Vinyl","Plafon - List","Akustik","Genteng","Atap","Banbanan genteng","Solartap","Partisi Gipsum","Partisi Kaca / Acrylic","Partisi Papan / Triplek","Dak beton","Pengecatan ulang","Talang dak","Pipa / Drain","Shap","Asrama PURI","Alderon","Wallguard","gantungan Jam","tutup menhole","Karpet Lantai","Kontruksi-add1?"
    ],
    "M.E. ( Umum )": [
      "Microwave","Kompor Listrik","Mesin fhoto copy","Hot Trolly","Stir/putaran File","Mesin TIK","Kode Biru","Mesin FEX","Mesin penghancur kertas","Mesin potong rambut","mesin Cuci piring","Plang petunjuk","TOA mushola","Mesin Absen","me-add1?","me-add2?","me-add3?","me-add4?","me-add5?","me-add6?","me-add7?","me-add8?","me-add9?","me-add10?","me-add11?"
    ],
    "M.E. ( Penerangan )": [
      "Saklar Lampu","Lampu LED 18w","Lampu Baca / Bedhead","Lampu LED 14w","Lampu Emergency","Lampu TL LED 14 WATT + 16 WATT","Lampu kulkas","Timer Switch Lampu","Ballast Lampu/ TL 36 Watt","Stater Lampu","Fitting Lampu","Lampu TL 36 w + LED","Lampu HPL / HPIT","Lampu LED DL -Tertutup 7 / 14 watt","TL 18w","Lampu LED 6 WATT + 12 WATT","Lampu PL-C 13 watt","Lampu PL-S 7 watt","Lampu T5 21 watt + 28 watt","Lampu TL36 w","Lampu Pijar 25 watt","Lampu T5 4 watt - 7w - 13 watt","Halopika  20 / 50 watt","Lampu LED 6w","Lampu LED 12w"
    ],
    "M.E. ( Kelistrikan )": [
      "Stop kontak","Steker","Kabel Power / Listrik","Kabel Rol","MCB / MCCB","Fuse","Contactor","Genset","Panel SDP","Panel PP","Panel LP","Panel-Panel","Cubical TM","Transformator","Capasitor Bank","ACB PLN","ACB Genset","Change Over Switch","LVMDP","Gardu PLN","Adaptor DC","Tiang lampu","Lampu LED TL 16w","Stop Kontak AC","listrik-add1?"
    ],
    "M.E. ( AC / Tata Udara / CHILLER )": [
      "Ac Sentral","Ac Split","Ac Split Duct","AC Standing Floor","Ac Cassette","AC HEPA FILTER","Motor Blower AC LW / Hepa","Pompa Drain Otomatis","Pengatur Suhu / Thermistor","Switch AC Central Honeywell","Kulkas","Air Curtain","Termistor AC","Exhaust Fan","Overload","Motor CWP","Pompa CWP","Motor Fan Blower/Swing ac Split","Panel & Sirkuit Kontrol Chiller","Valve Inlet / Valve Outlet","Remot AC","Pressure Gauge","CAPASITOR FAN -Compresor","Outdoor AC","Compresor AC"
    ],
    "M.E. ( Telekomunikasi / MA. TV )": [
      "Telepon","PABX","Sound Sistem / Paging","Gagang Telp","Speaker","CCTV"," TV/ DVD","Nurce Call","Switch Nurse Call ( NC )","Mesin EDC ( Electronic Data Capture )","Komputer PABX","Sinyal- Kabel jaringan/Antena","BTS","Kabel Spiral","Modulator SKY BOX","Adaptor","FiNGER ACCESS PINTU","HAEDSET -AIPHONE","MESIN CONSUL","Wireless","Remot TV","Intercom","Bel pintu masuk","Roset Telp","Box roset telefon"
    ],
    "M.E. ( Sistem Air Besih )": [
      "Pompa Deep Well","Meteran Air","Ground Tank","Roof Tank","Motor Roof Tank","Pompa Roof Tank","Motor Booster","Pompa Booster","Sensor WLC.","Sensor Radar / Pelampung.","Panel & Sirkuit Kontrol Air Bersih","Valve Inlet.","Valve Outlet.","Instalasi Plumbing Air Bersih","Strainer","Check Valve","Flexible Joint.","Pressure Gauge.","Pressure Tank","Pompa Dorong Air Bersih","Pompa jetpam","Sumur bor","Sistem-add1?","Sistem-add2?","Sistem-add2?"
    ],
    "M.E. ( Boiler /Air Panas )": [
      "Boiler","Calorifier","Tangki Kalori Fire","Water Heater","Softener","Chamsafe & Dosing Pump","Steam Trap","Pompa Feet Water","Tabung / Selang LPG","Thermostat","Selenoid","Instalasi Pipa Air Panas","Pressure Gauge Boiler","Presssure Switch","Check Valve Boiler","Flexible Hose","Valve Boiler","Tangki Supply Boiler","Motor Jockey Boiler","Pompa Jockey Boiler","Pompa Air Panas","Motor Air Panas","Panel & Sirkuit Kontrol Air Panas","Bell Alarm","pompa feed walter"
    ],
    "M.E. ( Genset )": [
      "Filter Solar","Filter Oli","Filter Udara Genset","OLI","Radiator","Baterai / Accu","Charger Baterai","Tangki Solar","Pompa Solar","Motor ( Pompa Solar)","Water Fuel Separator","MCB / MCCB","Cerobong Asap","Panel Kontrol / AMF Genset","Tes Engine / Running","Selang katup","PLN Padam / Mati"," Keluar barang","Genset-add1?","Genset-add2?","Genset-add3?","Genset-add4?","Genset-add5?","Genset-add6?","Gensset-add7?"
    ],
    "M.E. ( Fire Alarm )": [
      "Smoke Detector","Heat Detector","Terminal Box","Manual Push Botton","Panel Kontrol Fire Alarm","Smoke - Heat Detector","Alarm-add1?","Alarm-add2?","Alarm-add3?","Alarm-add4?","Alarm-add5?","Alarm-add6?","Alarm-add7?","Alarm-add8?","Alarm-add9?","Alarm-add10?","Alarm-add11?","Alarm-add12?","Alarm-add13?","Alarm-add14?","Alarm-add15?","Alarm-add16?","Alarm-add17?","Alarm-add18?","Alarm-add19?"
    ],
    "M.E. ( Laundry )": [
      "Mesin Cuci","Mesin Cuci Infeksius","Mesin Pengering","Sterika Uap","Compressor Angin","Steam","Switch ON - OFF setrika","Box saklar setrika","Troli infeksius","Switch Setrika Uap","Fush Botton","Kabel seterika","Bearing 6204","Swite seterika","Tombol keypad","Selang setrika uap","Pipa Steam","Laundry-add1?","Laundry-add2?","Laundry-add3?","Laundry-add4?","Laundry-add5?","Laundry-add6?","Laundry-add7?","Laundry-add8?"
    ],
    "M.E. ( Lift  / Eskalator )": [
      "Pintu Lift","Lampu Lift","Tombol Lift","Sangkar Lift","Sensor Lift","Mesin / Motor Lift","Panel Kontrol Lift","Accesoris Lift","Maintenance rutin","Alarm Aiopne","Pulley deflector","Escalator","Bearing/ Gear box","Power Supply","by pass lift","telfon lift","Kabel","jadwal rutin ON /OF lift gedung B","Selling Lift","Stiker lantai","Servis rutin","Thysen krup","Gondola","Wire Rope","General Check UP"
    ],
    "M.E. ( Hydrant )": [
      "Sprinker","Box Hydrant","Hydrant Pillar","Jockey Hydrant","Main Motor Hydrant","Mesin Diesel Hydrant","Pressure Tank Hydrant","Pressure Switch Hydrant","Panel Kontrol Hydrant","Pipa hydran","APAR","Hydrant-add1?","Hydrant-add2?","Hydrant-add3?","Hydrant-add4?","Hydrant-add5?","Hydrant-add6?","Hydrant-add7?","Hydrant-add8?","Hydrant-add9?","Hydrant-add10?","Hydrant-add11?","Hydrant-add12?","Hydrant-add13?","Hydrant-add14?"
    ],
    "ELEKTROMEDIK  ( Alat Medis )": [
      "Stetoskop","BOX X-Ray","Tensimeter","Roller - Pengaduk Darah","Infus Pump","Lampu Blue Light ( BL )","Lampu Infrared / Sorot Pasien","Lampu Operasi","Meja Operasi","Manometer","Monitor Pasien","Mesin RO","USG","TREADMILLE","Nebulizer","Saturasi O2","Compressor Air","Manset","Dental Unit","Rontgen Mobile ( Mobile X-Ray )","Pemindahan Alat HD","Mesin HD","Alat Scrining Suhu / Termometer","Mikroshop","Alat ECHO"
    ],
    "ELEKTROMEDIK  ( Umum )": [
      "Kursi Roda","Trolley Makanan","Roda Trolley / Roda Kursi","Tiang Infus/EEG/dll","Gantungan Infus","Breket","Ukuran Tinggi badan","Timbangan Bayi / Dewasa","Bed head","Brangkar","Remote tempat tidur pasien","UPS","Termometer","Alat Ukur Dindig","Roda rostur"," Intalasi Air RO HD","Vacuum","Timbangan Digital Linen","Trolley 02","Troly obat","Troly linen","Pengukur Suhu Ruangan","Brangkar/Bed","Gantungan /Lemari Apprond","Elektromedik-add1?"
    ],
    "ELEKTROMEDIK  ( Gas Medis )": [
      "Oksigen (Air Liquid) Sentral","Oksigen (Tabung O2 ) Sentral","Tabung O2 besar","Tabung O2 kecil","Tabung N2O","Tabung Udara Tekan","Outlet O2","Outlet N2O","Outlet Vakum /Suction","Regulator O2","Flow meter","Selang Oksigen","Conektor ventilator","Seal O2","Aqua pack","Gas-add1?","Gas-add2?","Gas-add3?","Gas-add4?","Gas-add5?","Gas-add6?","Gas-add7?","Gas-add8?","Gas-add9?","Gas-add10?"
    ],
    "KESLING ( Umum )": [
      "Manifest Jalan Hijau","Misting","Fogging","Lampu BL Insect killer","Trap massal","Bilik Disenfeksi","Desinfektan limbah B3","Limbah Medis B3","Bau Bangkai","Dispenser Viorek","Kesling-add1?","Kesling-add2?","Kesling-add3?","Kesling-add4?","Kesling-add5?","Kesling-add6?","Kesling-add7?","Kesling-add8?","Kesling-add9?","Kesling-add10?","Kesling-add11?","Kesling-add12?","Kesling-add13?","Kesling-add14?","Kesling-add15?"
    ],
    "KESLING ( Sistem IPAL )": [
      "IPAL","Sarang Tawon","Microplus","Blower STP","Motor ( Blower STP )","Diffuser","Timer Switch Blower","Pompa Submersible","Communitor","Sensor WLC","Sensor Radar / Pelampung","Valve","Flexible Joint","Limbah B3","Karbon Aktip","Ipal-add1?","Ipal-add2?","Ipal-add3?","Ipal-add4?","Ipal-add5?","Ipal-add6?","Ipal-add7?","Ipal-add8?","Ipal-add9?","Ipal-add10?"
    ],
    "KITCHEN /DAPUR": [
      "Mesin Chiler","Freezer","Mesin Diswashing","MIXER Duduk","Switch on-off","Pipa air panas","Pipa air dingin","Kitchen-add1?","Kitchen-add2?","Kitchen-add3?","Kitchen-add4?","Kitchen-add5?","Kitchen-add6?","Kitchen-add7?","Kitchen-add8?","Kitchen-add9?","Kitchen-add10?","Kitchen-add11?","Kitchen-add12?","Kitchen-add13?","Kitchen-add14?","Kitchen-add15?","Kitchen-add16?","Kitchen-add17?","Kitchen-add18?"
    ],
    "CEK LIST M.E. / UTILITI": [
      "ALL AREA","Cek List Ruang Anggrek","Cek List Panel Listrik","Cek List LMDV","Cek List Genset","Cek List Boiler","Cek List Chiller","Cek List Pompa Deep Well","Cek List Ground Tank","Cek List Roof Tank","Cek List Motor & Pompa Roof Tank","Cek List Motor & Pompa Jockey Boiler","Cek List Motor & Pompa Hydrant","Cek List Motor & Pompa Jockey Hydrant","Cek List Mesin Diesel Hydrant","Cek List Motor & Pompa Air Panas","Cek List Motor & Pompa Booster","Utility-add1?","Utility-add2?","Utility-add3?","Utility-add4?","Utility-add5?","Utility-add6?","Utility-add7?"
    ],
    "UMUM / Dan Lain - Lain": [
      "Benda Peraga","Rak / Data Try","Thyssenkrupp","Kotak K3RS","Cek List Ruangan","Pihak ke 3","Menurunkan Jenazah","Bau hangus","ASRAMA","pencatatan KWh meter","Foodcourt","Rapat Teknik","Setting sound","OTIS","Selang LPG","Area Dapur","Gantungan Masker","Gordyn","Area Rumah Tangga","Spanduk","Back Drop","Tess Food tender Catring","Rak buku","Lukisan / Gambar","gantungan baju"
    ]
  };
