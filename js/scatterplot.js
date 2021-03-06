/* global rdv */

window.scatterplot = function() {

    // range constants
    var SUPER_LOW_RANGE = [0, 1e-4];
    var VERY_LOW_RANGE = [0, 8e-4];
    var LOW_RANGE = [0, 5e-3];
    var MED_LOW_RANGE = [1e-4, 5e-3];
    var HIGH_LOW_RANGE = [8e-4, 5e-3];
    var MED_RANGE = [5e-3, 1e-2];
    var HIGH_RANGE = [1e-2, Infinity];
    var MED_HIGH_RANGE = [MED_RANGE[0], HIGH_RANGE[1]];
    var MIN_PPP = 2e-5;

    // margins
    var margin = { top: 15, bottom: 30, right: 15, left: 30 };
    var wMargin = margin.left + margin.right;
    var hMargin = margin.top + margin.bottom;

    // vis
    var vis = rdv.Vis(rdv.TWOD, MIN_PPP)
        .margin(margin);

    // scales
    var x = d3.scale.linear();
    var y = d3.scale.linear();

    // axes
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

    function container(selection, cls) {
        var sel = this.container = selection.selectAll('g.' + cls)
                .data([0]);

        return sel.enter().append("g")
            .attr('class', cls)
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    }

    function containerOff() {
            var container = this.container;
            if (container) {
                container.remove();
            }
            this.container = null;
    }

    vis.axes = new rdv.Feature({
        on: function(selection) {
            var vis = this.vis;

            var containerEntry = container.call(this, selection, 'axes');

            containerEntry.append("g")
                .attr("class", "x axis");

            containerEntry.append("g")
                .attr("class", "y axis");

            var minTickSize = 30;
            var xTickCount = Math.min(~~((vis.w() - wMargin) / minTickSize), 10);
            var yTickCount = Math.min(~~((vis.h() - hMargin) / minTickSize), 10);

            xAxis.ticks(xTickCount);
            yAxis.ticks(yTickCount);

            this.container.selectAll(".x.axis")
                .attr("transform", "translate(0," + (vis.h() - hMargin) + ")")
                .call(xAxis);

            this.container.selectAll(".y.axis")
                .call(yAxis);

        }
    });

    vis.circles = new rdv.Feature({
        range: LOW_RANGE,
        container: null,

        on: function(selection) {
            var vis = this.vis;
            var data = vis.data();

            container.call(this, selection, 'circles');

            var circles = this.container.selectAll('circle')
                .data(data);

            circles.enter().append('circle');

            circles.exit().remove();

            // determine radius
            var w = vis.w() - wMargin;
            var h = vis.h() - hMargin;
            var points = data.length;
            var targetPPP = 2e-2;
            var min = 2;
            var max = 12;
            var r = Math.sqrt(targetPPP * w * h / points);
            r = Math.min(max, Math.max(min, r));

            // TODO: Reduce vis size to reach min PPP

            circles.attr({
                cx: function(d) { return x(d.x); },
                cy: function(d) { return y(d.y); },
                r: r
            });
        },

        off: containerOff
    });

    vis.bins = new rdv.Feature({
        range: MED_HIGH_RANGE,
        container: null,

        on: function(selection) {
            var vis = this.vis;
            var data = vis.data();
            var w = vis.w() - wMargin;
            var h = vis.h() - hMargin;
            var targetPPP = 5e-3;

            // determine bin count
            var binCount = ~~Math.sqrt(w * h * targetPPP);

            var xBin = d3.scale.quantize()
                .domain(x.domain())
                .range(d3.range(binCount));
            var yBin = d3.scale.quantize()
                .domain(y.domain())
                .range(d3.range(binCount));

            var binData = new Array(binCount * binCount);
            for (var i = 0; i < binData.length; i++) binData[i] = 0;

            data.forEach(function(d) {
                var index = xBin(d.x) + (binCount * yBin(d.y));
                binData[index]++;
            });

            var color = d3.scale.sqrt()
                .domain([0, d3.max(binData)])
                .range([0, 1]);

            container.call(this, selection, 'bins');

            var bins = this.container.selectAll('rect')
                .data(binData);

            bins.enter().append('rect');

            bins.exit().remove();

            var rw = w / binCount;
            var rh = h / binCount;
            bins.attr({
                transform: function(d, i) {
                    return 'translate(' + ((i % binCount) * rw) + ',' + (h - rh - ~~(i / binCount) * rh) + ')';
                },
                width: rw,
                height: rh,
                opacity: color
            });
        },

        off: containerOff
    });

    var selected = [];

    function toggleSelection(d, toggle) {
        var index = selected.indexOf(d);
        toggle = toggle !== undefined ? toggle : index < 0;
        if (toggle) selected.push(d);
        else selected.splice(index, 1);
        return toggle;
    }

    function datumSelected(d) {
        return selected.indexOf(d) >= 0;
    }

    vis.pointSelection = new rdv.Feature({
        range: VERY_LOW_RANGE,

        on: function(selection) {

            function highlight() {
                d3.select(this).style('fill', 'red');
            }

            function clearHighlight() {
                d3.select(this).style('fill', null);
            }

            selection.selectAll('.circles circle')
                .classed('selected', datumSelected)
                .style('cursor', 'pointer')
                .on('mouseover.highlight', highlight)
                .on('mouseout.highlight', clearHighlight)
                .on('click.selection', function(d) {
                    var toggle = toggleSelection(d);
                    d3.select(this).classed('selected', toggle);
                    if (!toggle) clearHighlight.call(this);
                });
        },

        off: function(selection) {
            selection.selectAll('.circles circle')
                .classed('selected', false)
                .style('cursor', 'normal')
                .on('mouseover.highlight', null)
                .on('mouseout.highlight', null)
                .on('click.selection', null);
        }
    });

    vis.brushSelection = new rdv.Feature({
        range: HIGH_LOW_RANGE,
        container: null,
        brush: d3.svg.brush(),

        on: function(selection) {
            var brush = this.brush;
            var circles = d3.selectAll('.circles circle')
                .classed('selected-brush', datumSelected);

            container.call(this, selection, 'brush');
            var brushLayer = this.container;

            brush
                .x(x)
                .y(y)
                .on('brush', function() {
                    var extent = brush.extent();
                    circles.each(function(d) {
                        var isSelected =
                            extent[0][0] < d.x &&
                            d.x < extent[1][0] &&
                            extent[0][1] < d.y &&
                            d.y < extent[1][1];
                        toggleSelection(d, isSelected);
                        d3.select(this).classed('selected-brush', isSelected);
                    });
                })
                .on('brushend', function() {
                    brush.clear();
                    brushLayer.selectAll('.extent')
                        .attr('width', 0)
                        .attr('height', 0)
                        .attr('x', 0)
                        .attr('y', 0);
                });

            brushLayer.call(brush);
        },

        off: function(selection) {
            containerOff.call(this, selection);
            selection.selectAll('.circles circle')
                .classed('selected-brush', false);
        }
    });

    vis.binSelection = new rdv.Feature({
        range: MED_HIGH_RANGE,

        on: function(selection) {

            function highlight() {
                d3.select(this).style('fill', 'red');
            }

            function clearHighlight() {
                d3.select(this).style('fill', null);
            }

            selection.selectAll('.bins rect')
                .style('cursor', 'pointer')
                .on('mouseover.highlight', highlight)
                .on('mouseout.highlight', clearHighlight)
                .on('click.selection', function() {
                    var rect = d3.select(this);
                    var toggle = !rect.classed('selected');
                    rect.classed('selected', toggle);
                    if (!toggle) clearHighlight.call(this);
                });
        },

        off: function(selection) {
            selection.selectAll('.bins rect')
                .classed('selected', false)
                .style('cursor', 'normal')
                .on('mouseover.highlight', null)
                .on('mouseout.highlight', null)
                .on('click.selection', null);
        }
    });

    vis.labels = new rdv.Feature({
        range: SUPER_LOW_RANGE,

        container: null,

        on: function(selection) {
            var vis = this.vis;
            var data = vis.data();

            container.call(this, selection, 'labels');

            var labels = this.container.selectAll('text')
                .data(data);

            labels.enter().append('text');

            labels.exit().remove();

            var w = vis.w() - wMargin;

            labels
                .attr({
                    x: function(d) { return x(d.x); },
                    y: function(d) { return y(d.y); },
                    dy: function(d) {
                        return y(d.y) > 40 ? '-15px' : '25px';
                    },
                    dx: function(d) {
                        var xpos = x(d.x);
                        return xpos < 20 ? '-13px' :
                            xpos > w - 20 ? '13px' :
                            '0';
                    },
                    'text-anchor': function(d) {
                        var xpos = x(d.x);
                        return xpos < 20 ? 'start' :
                            xpos > w - 20 ? 'end' :
                            'middle';
                    }
                })
                .text(function(d) { return d.name; });
        },

        off: containerOff
    });

    vis.tooltips = new rdv.Feature({
        range: MED_LOW_RANGE,
        tip: null,

        on: function(selection) {
            var tip = this.tip || d3.tip()
                .attr('class', 'd3-tip')
                .offset([-5, 0])
                .html(function(d) { return d.name; });

            selection.call(tip);

            selection.selectAll('.circles circle')
                .on('mouseover.tip', tip.show)
                .on('mouseout.tip', tip.hide);
        },

        off: function(selection) {
            selection.selectAll('.circles circle')
                .on('mouseover.tip', null)
                .on('mouseout.tip', null);
        }
    });

    vis.bintips = new rdv.Feature({
        range: MED_HIGH_RANGE,
        tip: null,

        on: function(selection) {
            var tip = this.tip || d3.tip()
                .attr('class', 'd3-tip')
                .offset([-5, 0])
                .html(function(d) { return d + ' points'; });

            selection.call(tip);

            selection.selectAll('.bins rect')
                .on('mouseover.tip', tip.show)
                .on('mouseout.tip', tip.hide);
        },

        off: function(selection) {
            selection.selectAll('.bins rect')
                .on('mouseover.tip', null)
                .on('mouseout.tip', null);
        }
    });


    vis.on('data', function(data) {
        x.domain(d3.extent(data, function(d) { return d.x; })).nice();
        y.domain(d3.extent(data, function(d) { return d.y; })).nice();
    });

    vis.on('resize', function(w, h) {
        x.range([0, w - wMargin]);
        y.range([h - hMargin, 0]);
    });

    return vis;

};
