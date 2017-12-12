<h1>Hello {{rule.title}}!</h1>

<p>{{_deburr && _deburr('Á')}}</p>

<p>{{casa}}</p>

<input type='number' bind:value='count'>
<button on:click='set({ count: count + 1 })'>count</button>

<script>
	export default {
		oncreate () {
			// console.log(1, this.options.data, this.refs);
		},
		ondestroy () {
			console.log('destroy!');
		}
	};
</script>