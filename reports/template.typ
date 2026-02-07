// Template LPJ Digital
#let lpj-report(
    divisi: "Nama Divisi",
    bulan: "Januari 2024",
    pelapor: "Nama Pelapor",
    logo-path: none,
    stempel-path: none,
    ttd-path: none,
    program-kerja: [],
    pemasukan-rows: (),
    pengeluaran-rows: (),
    total-pemasukan: 0,
    total-pengeluaran: 0,
    evaluasi: [],
    rencana: [],
    generated-at: "",
    doc,
  ) = {
    set page(paper: "a4", margin: (x: 1.5cm, y: 1.5cm))
    set text(font: "Libertinus Serif", size: 11pt)

    // Header
    grid(
      columns: (60pt, 1fr),
      gutter: 15pt,
      if logo-path != none { image(logo-path, width: 100%) } else { [] },
      [
        #set align(center)
        #text(size: 14pt, weight: "bold")[PONDOK PESANTREN AT-TAUJIEH AL-ISLAMY 2] \
        #text(size: 9pt)[Leler, Randegan, Kebasen, Banyumas, Jawa Tengah] \
        #v(0.5em)
        #text(size: 12pt, weight: "bold")[LAPORAN PERTANGGUNGJAWABAN (LPJ) BULANAN]
      ]
    )
    v(-0.5em)
    line(length: 100%, stroke: 1.5pt)
    v(0.5em)

    // Meta Data
    grid(
      columns: (80pt, 8pt, 1fr),
      gutter: 0.5em,
      [#strong[Divisi/Bagian]], [:], [#divisi],
      [#strong[Bulan]], [:], [#bulan],
      [#strong[Pelapor]], [:], [#pelapor],
    )

    v(0.5em)

    // Content Sections
    let section(title, body) = [
      #v(0.5em)
      #text(fill: rgb("#1e40af"), size: 11pt, weight: "bold")[#title]
      #v(0.2em)
      #block(width: 100%, inset: (left: 5pt))[#body]
    ]

    let format-currency(num) = {
      let s = str(num)
      let res = ""
      let count = 0
      for i in range(s.len() - 1, -1, step: -1) {
        if count == 3 and s.at(i) != "-" {
          res = "." + res
          count = 0
        }
        res = s.at(i) + res
        count += 1
      }
      res
    }

    section("1. Realisasi Program Kerja")[
      #program-kerja
    ]

    section("2. Laporan Keuangan")[
      #v(0.2em)
      #strong[Rincian Pemasukan:]
      #table(
        columns: (300pt, 100pt),
        stroke: none,
        fill: (x, y) => if calc.even(y) { gray.lighten(95%) },
        inset: 5pt,
        ..pemasukan-rows.flatten()
      )

      #v(0.3em)
      #strong[Rincian Pengeluaran:]
      #table(
        columns: (300pt, 100pt),
        stroke: none,
        fill: (x, y) => if calc.even(y) { gray.lighten(95%) },
        inset: 5pt,
        ..pengeluaran-rows.flatten()
      )

      #v(0.5em)
      #block(width: 500pt)[
        #set align(left)
        #grid(
          columns: (300pt, 100pt),
          gutter: 0.4em,
          [Total Pemasukan], [Rp #format-currency(total-pemasukan)],
          [Total Pengeluaran], [Rp #format-currency(total-pengeluaran)],
          [#strong[Saldo Akhir]], [#text(fill: if total-pemasukan - total-pengeluaran >= 0 { green } else { red })[#strong[Rp #format-currency(total-pemasukan - total-pengeluaran)]]]
        )
      ]
    ]

    section("3. Evaluasi & Kendala")[
      #evaluasi
    ]

    section("4. Rencana Bulan Depan")[
      #rencana
    ]

    v(1fr)

    // Signatures
    set align(right)
    block(width: 150pt)[
      #set align(center)
      Mengetahui, \
      Kepala Divisi, \
      #v(0.5em)
      #stack(
        if stempel-path != none { image(stempel-path, width: 85pt) } else { [] },
      )
      #strong[(#pelapor)]
    ]

    v(1fr)
    set align(center)
    set text(size: 8pt, fill: gray)
    line(length: 100%, stroke: 0.5pt + gray)
    [Dicetak secara otomatis melalui Sistem LPJ Digital \ ]
    [Generated: #generated-at]
}
